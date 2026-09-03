import { NextRequest, NextResponse } from "next/server";
import { verifyCashfreeWebhookSignature } from "@/lib/payments/cashfree.client";
import { processVerifiedWebhook } from "@/lib/payments/payment.service";
import type { CashfreeWebhookPayload } from "@/lib/payments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook
 *
 * Cashfree calls this URL directly (configured as `notify_url` per-order
 * AND as the account-level webhook in the Cashfree dashboard). Exact flow,
 * in order, per requirement #10/#11/#12/#13:
 *
 *   1. Read the RAW request body as text — signature verification needs
 *      the exact bytes Cashfree signed, not a re-serialized JSON object.
 *   2. Verify the `x-webhook-signature` HMAC using CASHFREE_CLIENT_SECRET.
 *      Reject (401) immediately on any failure, BEFORE parsing the body
 *      or touching the database.
 *   3. Parse the (now-trusted) body only to read `order_id` — every other
 *      fact used to grant anything is re-fetched from Cashfree's Orders
 *      API server-side (fetchCashfreeOrderPayments), never taken from the
 *      webhook body itself. This means even a theoretically-forged-but-
 *      signature-valid payload can't lie about payment status.
 *   4. Hand off to processVerifiedWebhook(), which calls the idempotent
 *      public.process_cashfree_payment() Postgres function — safe to
 *      invoke any number of times for the same order_id.
 *
 * Always returns 200 once the webhook has been authenticated and handled
 * (including "payment not successful" cases) so Cashfree does not retry
 * indefinitely for outcomes we've already recorded. Only signature
 * failures and unexpected server errors return non-200.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";

  const isValid = verifyCashfreeWebhookSignature({ rawBody, timestamp, signature });
  if (!isValid) {
    console.error("[payments] webhook signature verification failed");
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let payload: CashfreeWebhookPayload | null = null;
  try {
    payload = JSON.parse(rawBody) as CashfreeWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const orderId = payload?.data?.order?.order_id;
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "missing order_id" }, { status: 400 });
  }

  try {
    const result = await processVerifiedWebhook(orderId, payload);
    return NextResponse.json({ ok: true, status: result.status, processed: result.processed });
  } catch (error) {
    console.error("[payments] webhook processing error:", error);
    // 500 here is intentional: it tells Cashfree to retry, which is safe
    // because process_cashfree_payment is idempotent per order_id.
    return NextResponse.json({ ok: false, error: "processing failed" }, { status: 500 });
  }
}
