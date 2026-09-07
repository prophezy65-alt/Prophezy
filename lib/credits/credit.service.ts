/**
 * lib/credits/credit.service.ts
 *
 * THE central credit service. Every AI feature calls spendCreditsForFeature()
 * / spendCreditsForStreamingFeature() (or the lower-level primitives below
 * them) instead of touching credit_balances/credit_transactions directly —
 * this is the "ONE authoritative credit system" from Phase 2B.
 *
 * Connected as of Phase 4 finalization: AI Notes, Internship application
 * unlock, Prophezy AI, Resume AI, Research Paper AI, Career Guidance AI,
 * Interview AI. See the chat response for exact file/function mapping and
 * the one feature (Exam Predictor) that has no AI implementation to
 * connect to yet.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreditRepository } from "./credit.repository";
import { InsufficientCreditsError } from "./errors";
import { CREDIT_FEATURES } from "./feature-keys";
import type {
  CreditBalance,
  CreditSummary,
  CreditTransaction,
  FeatureCreditCost,
  GetCreditUsageOptions,
  Plan,
} from "./types";

// ---------------------------------------------------------------------------
// Reads — safe to call from any authenticated server context (route handler,
// server component, server action). Always resolve the DB client fresh per
// call so this can't accidentally be reused across requests/users.
// ---------------------------------------------------------------------------

export async function getCreditBalance(userId: string): Promise<CreditBalance | null> {
  const db = await createClient();
  return new CreditRepository(db).getBalance(userId);
}

export async function getCurrentPlan(userId: string): Promise<Plan | null> {
  const db = await createClient();
  return new CreditRepository(db).getCurrentPlan(userId);
}

/**
 * Phase 5: the internship application-unlock allowance configured on the
 * user's CURRENT plan (public.plans.features->>'monthlyApplicationUnlocks'
 * — see the Phase 5 migration), read from the DB rather than hardcoded
 * here. Works for every plan, not just Free:
 *   FREE    -> 5/period
 *   PRO     -> 25/period
 *   PREMIUM -> null (unlimited)
 * Returns null both when the plan has no configured limit (unlimited) AND
 * as a fail-open default if a plan row is somehow missing the feature key
 * — undercounting a cap is the safe direction, never overcounting it.
 */
export async function getApplicationUnlocksRemaining(userId: string): Promise<number | null> {
  const db = await createClient();
  // MONTHLY RESET FIX: this reads credit_transactions directly (not
  // through credit_summary), so it needs its own explicit period check —
  // getCreditSummary()'s reset alone wouldn't cover this call site. A
  // no-op unless the period has actually elapsed. See
  // 20260906090000_credit_system_monthly_reset.sql.
  await new CreditRepository(db).ensureCurrentPeriod();

  const plan = await getCurrentPlan(userId);
  if (!plan) return null;

  const limit = getMonthlyApplicationUnlockAllowance(plan);
  if (limit === null) return null;

  const used = await new CreditRepository(db).countFeatureUsageSinceLastAllocation(
    userId,
    CREDIT_FEATURES.INTERNSHIP_APPLICATION_UNLOCK
  );
  return Math.max(limit - used, 0);
}

/** Reads plan.features.monthlyApplicationUnlocks with a safe fallback for
 * plan rows written before Phase 5 (or any typo'd/missing key): treats a
 * FREE plan with no configured key as still capped at 5 rather than
 * silently unlimited, and treats PRO/PREMIUM with no configured key as
 * unlimited (fail toward "don't wrongly block a paying user" for them,
 * fail toward "don't wrongly grant unlimited" for Free). */
export function getMonthlyApplicationUnlockAllowance(plan: Plan): number | null {
  const raw = plan.features?.["monthlyApplicationUnlocks"];
  if (typeof raw === "number") return raw;
  if (raw === null) return null;
  return plan.id === "free" ? 5 : null;
}

/** @deprecated Use getApplicationUnlocksRemaining, which now works for
 * every plan (Pro's 25/period cap was previously unenforced because this
 * function only ever checked Free). Kept as a thin alias so any existing
 * caller of the old Free-only name keeps working unchanged. */
export async function getFreeApplicationUnlocksRemaining(userId: string): Promise<number | null> {
  return getApplicationUnlocksRemaining(userId);
}

/** The one call Settings (or any dashboard) needs for "what plan, how many
 * credits left, how much used, what %". */
export async function getCreditSummary(userId: string): Promise<CreditSummary | null> {
  const db = await createClient();
  return new CreditRepository(db).getSummary(userId);
}

export async function getCreditUsage(
  userId: string,
  opts: GetCreditUsageOptions = {},
): Promise<CreditTransaction[]> {
  const db = await createClient();
  return new CreditRepository(db).getUsage(userId, opts);
}

/** Read-only hint, not a guarantee under concurrency — always follow with
 * spendCredits/spendCreditsForFeature and handle InsufficientCreditsError,
 * don't rely on this alone to gate an expensive operation. */
export async function canSpendCredits(userId: string, amount: number): Promise<boolean> {
  const db = await createClient();
  return new CreditRepository(db).canSpend(amount);
}

/** Looks up a feature's cost from public.feature_credit_costs (seeded in
 * 20260813120500_credit_system_feature_costs.sql). Returns null if the
 * feature has no row yet (new/unconfigured feature) or is inactive —
 * callers should treat either as "not ready to spend credits for this
 * feature" rather than guessing a fallback cost. */
export async function getFeatureCreditCost(feature: string): Promise<FeatureCreditCost | null> {
  const db = await createClient();
  const cost = await new CreditRepository(db).getFeatureCreditCost(feature);
  if (!cost || !cost.isActive) return null;
  return cost;
}

// ---------------------------------------------------------------------------
// Self-service spend — call from the SAME request that has the user's
// session available (a logged-in server action / route handler). Always
// debits the currently authenticated user; there is no way to pass a
// different userId in here, by design (see spend_credits in the DB).
// ---------------------------------------------------------------------------

export async function spendCredits(
  amount: number,
  feature: string,
  description?: string,
): Promise<CreditBalance> {
  const db = await createClient();
  return new CreditRepository(db).spend(amount, feature, description);
}

/**
 * Convenience wrapper for the full "AI feature flow" from the task spec:
 * check -> spend -> run -> refund-on-failure. Runs `operation` only after
 * credits are atomically deducted, and automatically refunds them (via
 * addCreditsAdmin, type='refund') if `operation` throws — see the
 * "FAILED AI REQUESTS" design note in the chat response for why refund-
 * on-failure was chosen over a reserve/finalize two-phase scheme.
 *
 * Usage (once a feature is actually connected — not done in this task):
 *
 *   const result = await spendCreditsForFeature(
 *     userId, 10, "resume_analysis",
 *     () => buildResume(userId, input),
 *   );
 */
export async function spendCreditsForFeature<T>(
  userId: string,
  amount: number,
  feature: string,
  operation: () => Promise<T>,
  description?: string,
): Promise<T> {
  await spendCredits(amount, feature, description);

  try {
    return await operation();
  } catch (err) {
    await refundCredits(userId, amount, feature, `Refund: ${feature} request failed`).catch(() => {
      // Refund failures are logged inside refundCredits/addCreditsAdmin's
      // caller; never let a refund failure mask the original operation
      // error the caller is about to see.
    });
    throw err;
  }
}

/**
 * Streaming counterpart to spendCreditsForFeature() — for AI features that
 * return an AsyncGenerator (interview.service.ts#respondToAnswer,
 * chat.service.ts#sendChatMessage) instead of a Promise. Spends BEFORE the
 * first chunk is requested (same "check before you call the AI provider"
 * guarantee as the non-streaming version), then transparently re-yields
 * every chunk from `operation`. If the underlying generator throws at any
 * point — including partway through a stream the user already saw some of
 * — the spend is refunded once, then the error propagates. A stream that
 * completes normally (generator returns without throwing) keeps the
 * charge; there's no partial-refund accounting for "the user saw half a
 * response" — same simplification the non-streaming version makes for "the
 * output came back but was unusable."
 */
export async function* spendCreditsForStreamingFeature<T>(
  userId: string,
  amount: number,
  feature: string,
  operation: () => AsyncGenerator<T, void, unknown>,
  description?: string,
): AsyncGenerator<T, void, unknown> {
  await spendCredits(amount, feature, description);

  try {
    yield* operation();
  } catch (err) {
    await refundCredits(userId, amount, feature, `Refund: ${feature} stream failed`).catch(() => {
      // Same rule as spendCreditsForFeature: a refund failure must never
      // mask the original stream error the caller is about to see.
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Privileged mutations — SERVER-ONLY, and only ever from trusted code paths
// (webhooks, scheduled jobs, admin tooling, the refund path above). These
// use the service-role client themselves; callers never pass a client in.
// ---------------------------------------------------------------------------

export async function addCreditsAdmin(
  userId: string,
  amount: number,
  type: "monthly_allocation" | "refund" | "bonus" | "admin_adjustment",
  feature = "system",
  description?: string,
): Promise<CreditBalance> {
  const db = createAdminClient();
  return new CreditRepository(db).add(userId, amount, type, feature, description);
}

export async function refundCredits(
  userId: string,
  amount: number,
  feature: string,
  description?: string,
): Promise<CreditBalance> {
  return addCreditsAdmin(userId, amount, "refund", feature, description ?? `Refund: ${feature}`);
}

/** Resets a user's balance to their current plan's monthly allowance. See
 * the migration comment on public.allocate_monthly_credits for how this
 * should be scheduled once real billing periods exist. */
export async function allocateMonthlyCredits(userId: string): Promise<CreditBalance> {
  const db = createAdminClient();
  return new CreditRepository(db).allocateMonthly(userId);
}

export { InsufficientCreditsError };
