/**
 * lib/payments/types.ts
 * Types for the Cashfree payment integration.
 */

export type PayablePlanId = "pro" | "premium";

export interface PlanPrice {
  planTier: PayablePlanId;
  amountInr: number;
  credits: number;
  /** null = unlimited (Premium). */
  internshipUnlocks: number | null;
}

export type PaymentOrderStatus =
  | "created"
  | "active"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

export interface PaymentOrder {
  id: string;
  orderId: string;
  userId: string;
  planTier: PayablePlanId;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  cfOrderId: string | null;
  cfPaymentId: string | null;
  paymentSessionId: string | null;
  processed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderResult {
  orderId: string;
  paymentSessionId: string;
  amount: number;
  currency: string;
  planTier: PayablePlanId;
  environment: "production" | "sandbox";
}

/** Normalized Cashfree payment status, mapped from their various payment_status values. */
export type NormalizedCashfreeStatus = "SUCCESS" | "FAILED" | "PENDING" | "CANCELLED";

export interface CashfreeOrderCreateResponse {
  cf_order_id: string;
  order_id: string;
  order_status: string;
  payment_session_id: string;
  order_amount: number;
  order_currency: string;
}

export interface CashfreePaymentEntry {
  cf_payment_id: string;
  order_id: string;
  payment_status: string; // SUCCESS | FAILED | PENDING | USER_DROPPED | CANCELLED | ...
  payment_amount: number;
  payment_currency: string;
  payment_time?: string;
}

export interface CashfreeWebhookPayload {
  type: string; // e.g. "PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"
  data: {
    order: {
      order_id: string;
      order_amount?: number;
      order_currency?: string;
    };
    payment: {
      cf_payment_id: string;
      payment_status: string;
      payment_amount?: number;
      payment_currency?: string;
      payment_time?: string;
    };
  };
  event_time?: string;
}
