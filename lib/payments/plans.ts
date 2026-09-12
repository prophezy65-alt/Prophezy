/**
 * lib/payments/plans.ts
 *
 * THE authoritative price list for paid plans. The pricing button in the
 * UI only ever sends a `planTier` string ("pro" | "premium") — never an
 * amount. The server looks the amount up from here, not from anything the
 * browser sent, so there is no code path by which a client request can
 * change what gets charged.
 *
 * These numbers mirror public.plans (20260831090000_credit_system_phase5_final_plan_economy.sql)
 * exactly. They're duplicated here (rather than queried from the DB on
 * every checkout) so order creation has one less network hop and can never
 * be affected by someone editing plan rows for display purposes — if the
 * business prices ever change, update BOTH this file and the plans table
 * in the same change.
 */

import type { PayablePlanId, PlanPrice } from "./types";

// Re-exported so other modules (e.g. payment.service.ts) can import the
// type from "./plans" alongside getPlanPrice/isPayablePlan without a
// second import line back to "./types".
export type { PayablePlanId } from "./types";

export const PLAN_PRICES: Record<PayablePlanId, PlanPrice> = {
  pro: {
    planTier: "pro",
    amountInr: 79,
    credits: 500,
    internshipUnlocks: 25,
  },
  premium: {
    planTier: "premium",
    amountInr: 99,
    credits: 700,
    internshipUnlocks: null, // unlimited
  },
};

export function isPayablePlan(value: unknown): value is PayablePlanId {
  return value === "pro" || value === "premium";
}

export function getPlanPrice(planTier: PayablePlanId): PlanPrice {
  return PLAN_PRICES[planTier];
}
