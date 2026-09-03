/**
 * lib/payments/cashfree.client.ts
 *
 * Thin server-only wrapper around the Cashfree Payment Gateway REST API
 * (Web Checkout / Orders API). SERVER-SIDE ONLY — never import this from a
 * Client Component. CASHFREE_CLIENT_SECRET is read here and is never sent
 * to, or exposed in, the browser bundle.
 *
 * Docs: https://docs.cashfree.com/reference/pg-new-apis-endpoint
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CashfreeOrderCreateResponse,
  CashfreePaymentEntry,
  NormalizedCashfreeStatus,
} from "./types";

const API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";

function getEnvironment(): "production" | "sandbox" {
  const env = (process.env.CASHFREE_ENVIRONMENT || "").toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

function getBaseUrl(): string {
  return getEnvironment() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET in the server environment."
    );
  }
  return { clientId, clientSecret };
}

function authHeaders(): Record<string, string> {
  const { clientId, clientSecret } = getCredentials();
  return {
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
    "x-api-version": API_VERSION,
    "Content-Type": "application/json",
  };
}

export interface CreateCashfreeOrderInput {
  orderId: string;
  amountInr: number;
  customerId: string;
  customerEmail: string | null;
  customerPhone: string;
  returnUrl: string;
  notifyUrl: string;
  orderTags: Record<string, string>;
}

/**
 * Creates an order with Cashfree. This is the ONLY place an order is
 * created — always server-side, always with an amount the SERVER decided
 * (see lib/payments/plans.ts), never a value read from the request body.
 */
export async function createCashfreeOrder(
  input: CreateCashfreeOrderInput
): Promise<CashfreeOrderCreateResponse> {
  const res = await fetch(`${getBaseUrl()}/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amountInr,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerId,
        customer_email: input.customerEmail || undefined,
        customer_phone: input.customerPhone,
      },
      order_meta: {
        return_url: input.returnUrl,
        notify_url: input.notifyUrl,
      },
      order_tags: input.orderTags,
    }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(
      `Cashfree order creation failed (${res.status}): ${
        body?.message || (await safeText(res))
      }`
    );
  }
  return body as CashfreeOrderCreateResponse;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "unknown error";
  }
}

/**
 * Fetches the order's current status directly from Cashfree — used as a
 * server-side re-verification step, never trusted from a redirect query
 * string or the browser.
 */
export async function fetchCashfreeOrderStatus(
  orderId: string
): Promise<{ orderStatus: string }> {
  const res = await fetch(`${getBaseUrl()}/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(`Cashfree order status fetch failed (${res.status})`);
  }
  return { orderStatus: body.order_status as string };
}

/**
 * Fetches the list of payment attempts for an order directly from
 * Cashfree. Used to independently re-verify a payment server-side rather
 * than trusting the webhook payload alone (belt-and-braces — the webhook
 * signature is already verified before this is called; this additionally
 * protects against a forged/replayed request that somehow got a valid
 * signature for stale data).
 */
export async function fetchCashfreeOrderPayments(
  orderId: string
): Promise<CashfreePaymentEntry[]> {
  const res = await fetch(
    `${getBaseUrl()}/orders/${encodeURIComponent(orderId)}/payments`,
    { method: "GET", headers: authHeaders(), cache: "no-store" }
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body)) {
    throw new Error(`Cashfree payments fetch failed (${res.status})`);
  }
  return body as CashfreePaymentEntry[];
}

/** Maps Cashfree's various payment_status strings onto our normalized set. */
export function normalizeCashfreePaymentStatus(
  status: string | undefined | null
): NormalizedCashfreeStatus {
  switch ((status || "").toUpperCase()) {
    case "SUCCESS":
      return "SUCCESS";
    case "PENDING":
      return "PENDING";
    case "USER_DROPPED":
    case "CANCELLED":
    case "VOID":
      return "CANCELLED";
    default:
      return "FAILED";
  }
}

/**
 * Picks the most authoritative status out of a list of payment attempts
 * for an order: a SUCCESS anywhere in the list wins (an order can have
 * multiple attempts if the user retried after a drop/failure).
 */
export function resolveOrderPaymentStatus(
  payments: CashfreePaymentEntry[]
): { status: NormalizedCashfreeStatus; payment: CashfreePaymentEntry | null } {
  const success = payments.find(
    (p) => normalizeCashfreePaymentStatus(p.payment_status) === "SUCCESS"
  );
  if (success) return { status: "SUCCESS", payment: success };

  const pending = payments.find(
    (p) => normalizeCashfreePaymentStatus(p.payment_status) === "PENDING"
  );
  if (pending) return { status: "PENDING", payment: pending };

  const latest = payments[0] ?? null;
  return {
    status: latest ? normalizeCashfreePaymentStatus(latest.payment_status) : "FAILED",
    payment: latest,
  };
}

/**
 * Verifies a Cashfree webhook's HMAC-SHA256 signature.
 *
 * Per Cashfree's documented scheme: signedPayload = timestamp + rawBody;
 * signature = base64(HMAC-SHA256(signedPayload, CASHFREE_CLIENT_SECRET)).
 * The signature is compared using a constant-time comparison to avoid
 * timing side-channels. `rawBody` MUST be the exact, unparsed request
 * body bytes/string — re-serializing a parsed JSON object will not
 * reliably reproduce the byte sequence Cashfree signed and will cause
 * legitimate webhooks to fail verification.
 */
export function verifyCashfreeWebhookSignature(params: {
  rawBody: string;
  timestamp: string;
  signature: string;
}): boolean {
  const { clientSecret } = getCredentials();
  const { rawBody, timestamp, signature } = params;

  if (!rawBody || !timestamp || !signature) return false;

  const signedPayload = timestamp + rawBody;
  const expected = createHmac("sha256", clientSecret)
    .update(signedPayload)
    .digest("base64");

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(signature);

  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function getCashfreeEnvironment(): "production" | "sandbox" {
  return getEnvironment();
}
