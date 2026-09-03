/**
 * lib/payments/payment.service.ts
 *
 * Orchestration layer between the API routes and (a) the Cashfree REST API
 * and (b) Supabase. Two entry points:
 *
 *   - createOrderForUser(...)   called by POST /api/payments/create-order
 *   - processVerifiedWebhook(...) called by POST /api/payments/webhook,
 *     AFTER the caller has already verified the HMAC signature.
 *
 * Nothing in this file trusts client input for the payment amount or plan
 * entitlement grant — amount comes from lib/payments/plans.ts, and the
 * grant is applied only via public.process_cashfree_payment(), which is
 * itself keyed off the server-created payment_orders row, not the webhook
 * body.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCashfreeOrder,
  fetchCashfreeOrderPayments,
  getCashfreeEnvironment,
  resolveOrderPaymentStatus,
} from "./cashfree.client";
import { getPlanPrice, type PayablePlanId } from "./plans";
import type { CreateOrderResult, PaymentOrder } from "./types";
import { HttpError } from "./http";

function toPaymentOrder(row: Record<string, unknown>): PaymentOrder {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    userId: row.user_id as string,
    planTier: row.plan_tier as PayablePlanId,
    amount: Number(row.amount),
    currency: row.currency as string,
    status: row.status as PaymentOrder["status"],
    cfOrderId: (row.cf_order_id as string) ?? null,
    cfPaymentId: (row.cf_payment_id as string) ?? null,
    paymentSessionId: (row.payment_session_id as string) ?? null,
    processed: row.processed as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface CreateOrderParams {
  userId: string;
  userEmail: string | null;
  planTier: PayablePlanId;
  customerPhone: string;
  appBaseUrl: string;
}

/**
 * Creates a payment_orders row FIRST (status='created'), then calls
 * Cashfree to create the matching order. If the Cashfree call fails, the
 * local row is marked 'failed' rather than left dangling, and the error
 * is surfaced to the caller. Order of operations matters: the local row
 * existing before the Cashfree call means the webhook handler can never
 * race ahead of an order it doesn't know about yet.
 */
export async function createOrderForUser(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  const price = getPlanPrice(params.planTier);
  const db = createAdminClient() as unknown as SupabaseClient;

  // Our own order id — never reused, globally unique, safe to expose to
  // Cashfree and to the browser.
  const orderId = `pz_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  const { error: insertError } = await db.from("payment_orders").insert({
    order_id: orderId,
    user_id: params.userId,
    plan_tier: price.planTier,
    amount: price.amountInr,
    currency: "INR",
    status: "created",
  });
  if (insertError) {
    throw new HttpError(500, "ORDER_CREATE_FAILED", "Could not start checkout. Please try again.");
  }

  try {
    const cfOrder = await createCashfreeOrder({
      orderId,
      amountInr: price.amountInr,
      customerId: params.userId,
      customerEmail: params.userEmail,
      customerPhone: params.customerPhone,
      returnUrl: `${params.appBaseUrl}/pricing/return?order_id=${orderId}`,
      notifyUrl: `${params.appBaseUrl}/api/payments/webhook`,
      orderTags: {
        user_id: params.userId,
        plan_tier: price.planTier,
      },
    });

    await db
      .from("payment_orders")
      .update({
        status: "active",
        cf_order_id: cfOrder.cf_order_id,
        payment_session_id: cfOrder.payment_session_id,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    return {
      orderId,
      paymentSessionId: cfOrder.payment_session_id,
      amount: price.amountInr,
      currency: "INR",
      planTier: price.planTier,
      environment: getCashfreeEnvironment(),
    };
  } catch (err) {
    await db
      .from("payment_orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
    console.error("[payments] Cashfree order creation failed:", err);
    throw new HttpError(502, "CASHFREE_UNAVAILABLE", "Payment provider is unavailable. Please try again.");
  }
}

/**
 * Called after the webhook route has verified the HMAC signature. Does an
 * INDEPENDENT server-side re-fetch of the order's payments from Cashfree
 * (rather than trusting the webhook body's payment_status alone) before
 * ever granting anything, then hands off to
 * public.process_cashfree_payment() — the single, idempotent, service-role
 * function that changes the plan and grants credits.
 */
export async function processVerifiedWebhook(orderId: string, rawWebhook: unknown): Promise<PaymentOrder> {
  const db = createAdminClient() as unknown as SupabaseClient;

  const payments = await fetchCashfreeOrderPayments(orderId);
  const { status, payment } = resolveOrderPaymentStatus(payments);

  const { data, error } = await db.rpc("process_cashfree_payment", {
    p_order_id: orderId,
    p_cf_payment_id: payment?.cf_payment_id ?? null,
    p_cf_status: status,
    p_raw_webhook: rawWebhook as object,
  });

  if (error) {
    console.error("[payments] process_cashfree_payment RPC failed:", error);
    throw new HttpError(500, "PAYMENT_PROCESSING_FAILED", "Could not process payment.");
  }

  return toPaymentOrder(data as Record<string, unknown>);
}
