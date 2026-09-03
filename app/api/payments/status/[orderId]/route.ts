import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireUser, ok, fail, HttpError } from "@/lib/payments/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/status/:orderId
 *
 * Used ONLY by the pricing/return page to show the user whether their
 * payment has been confirmed yet — it never grants anything itself, it
 * just reads the payment_orders row that the webhook has (or hasn't yet)
 * marked processed. RLS (payment_orders_select_own) already restricts
 * this to the caller's own orders; requireUser() + the .eq("user_id", ...)
 * below is defense in depth on top of that.
 *
 * IMPORTANT: this endpoint is informational only. Nothing about this
 * route path grants credits or changes a plan — that only ever happens
 * inside the webhook handler via public.process_cashfree_payment().
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await requireUser();
    const { orderId } = await params;
    if (!orderId) throw new HttpError(400, "INVALID_REQUEST", "Missing order id.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_orders")
      .select("order_id, status, plan_tier, processed, amount, currency")
      .eq("order_id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
    }

    return ok({
      orderId: data.order_id,
      status: data.status,
      planTier: data.plan_tier,
      processed: data.processed,
      amount: Number(data.amount),
      currency: data.currency,
    });
  } catch (error) {
    return fail(error);
  }
}
