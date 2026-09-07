/**
 * lib/credits/entitlements.service.ts
 *
 * Phase 5 — THE single authoritative entitlement layer. Every place that
 * needs to answer "what plan is this user on / how many credits do they
 * have / how many internship unlocks are left / can they use this
 * feature" should call getEntitlements() or hasFeatureAccess() here,
 * instead of re-deriving plan/credit/unlock logic in components, API
 * routes, or feature services.
 *
 * This deliberately does not introduce a new source of truth: it composes
 * the existing getCreditSummary() / getCurrentPlan() /
 * getApplicationUnlocksRemaining() reads (credit.service.ts, which in turn
 * reads public.credit_summary / public.plans / public.credit_transactions)
 * into one snapshot. Nothing here writes to the database — mutations still
 * go exclusively through credit.service.ts's spend/add/allocate functions,
 * which in turn only ever call the SECURITY DEFINER Postgres functions.
 */

import { createClient } from "@/lib/supabase/server";
import { CreditRepository } from "./credit.repository";
import { getCreditSummary, getCurrentPlan, getApplicationUnlocksRemaining, getFeatureCreditCost } from "./credit.service";
import { getMonthlyApplicationUnlockAllowance } from "./credit.service";
import type { Entitlements } from "./types";

/**
 * The one call any surface (Settings, internship unlock gate, a future
 * plan-gated feature) needs for a complete, authoritative "what is this
 * user entitled to right now" snapshot. Always resolves the plan from
 * Supabase (subscriptions.plan_tier -> plans) — never accepts a
 * client-supplied plan, and there is no parameter for one.
 */
export async function getEntitlements(userId: string): Promise<Entitlements | null> {
  // MONTHLY RESET FIX: getCreditSummary() and getApplicationUnlocksRemaining()
  // each independently guarantee the current billing period before reading
  // (see credit.repository.ts / 20260906090000_credit_system_monthly_reset.sql),
  // but getCurrentPlan() does not — it's a plain table read with no reset
  // logic of its own. Running Promise.all below without first awaiting a
  // reset could, in the rare case this exact call is what triggers a
  // period rollover, return an already-reset credit summary alongside a
  // stale (pre-downgrade) plan from the parallel getCurrentPlan() call.
  // Resolving the reset here first, synchronously, means every read below
  // is guaranteed to see the same, already-settled period.
  const db = await createClient();
  await new CreditRepository(db).ensureCurrentPeriod();

  const [summary, plan, applicationUnlocksRemaining] = await Promise.all([
    getCreditSummary(userId),
    getCurrentPlan(userId),
    getApplicationUnlocksRemaining(userId),
  ]);

  // credit_summary requires both a credit_balances AND a subscriptions row
  // (inner-joined — see 20260813120200_credit_system_functions.sql). If
  // either is missing (shouldn't happen post-signup; handle_new_user
  // creates both), fail closed to null rather than fabricating zeros —
  // callers should treat null as "entitlements unavailable", not "no
  // credits", and investigate rather than silently rendering 0/0.
  if (!summary || !plan) return null;

  return {
    userId,
    plan,
    subscriptionStatus: summary.subscriptionStatus,
    creditsRemaining: summary.creditsRemaining,
    creditsUsedThisPeriod: summary.creditsUsedThisPeriod,
    monthlyCreditAllowance: summary.monthlyCredits,
    applicationUnlockAllowance: getMonthlyApplicationUnlockAllowance(plan),
    applicationUnlocksRemaining,
  };
}

/**
 * Answers "is `feature` available to this user's plan right now" —
 * intentionally scoped to exactly the restrictions Phase 5 defines
 * (credit-gated AI features + the internship unlock cap), not an
 * invented feature-flag system. A feature is available if:
 *   - it has an active row in feature_credit_costs (the central
 *     feature -> cost config — an inactive/missing row means the
 *     feature isn't wired to spend against yet, same "not ready" rule
 *     credit.service.ts already uses), AND
 *   - the user can currently afford its cost.
 * This does NOT special-case the internship unlock's separate
 * per-period cap — call getApplicationUnlocksRemaining()/getEntitlements()
 * for that, since "can I afford it" and "have I hit my period limit" are
 * independent checks per the Phase 4/5 spec.
 */
export async function hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
  const cost = await getFeatureCreditCost(feature);
  if (!cost) return false;

  const entitlements = await getEntitlements(userId);
  if (!entitlements) return false;

  return entitlements.creditsRemaining >= cost.creditCost;
}
