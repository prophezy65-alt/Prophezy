/**
 * lib/internships/services/application-unlock.service.ts
 *
 * NEW in Phase 4 — there was no server-side "unlock application" entry
 * point before this; the real applyUrl was only ever returned as part of
 * a normal internship record with no gating at all. This is the one
 * function that should be called when a user actually unlocks/applies to
 * an internship — never return applyUrl from a plain list/detail fetch.
 *
 * Flow (Phase 5 — generalized to every plan, not just Free):
 *   1. resolve current plan (server-side, via lib/credits)
 *   2. check that plan's monthly application-unlock allowance (Free=5,
 *      Pro=25, Premium=unlimited — read from plans.features, never
 *      hardcoded here); Premium has no cap so this check is a no-op for it
 *   3. spend 1 credit via the central credit service (atomic, refunds on
 *      failure automatically)
 *   4. fetch the internship and return its REAL applyUrl
 *   5. bump the existing apply_count counter (InternshipRepository already
 *      has this — reused, not duplicated)
 *   6. persist the unlock durably (internship_unlocks table) so it's
 *      visible again on any future page load/session
 *
 * PHASE 5 FIX: prior to this, step 2 only ran `if (isFree)` — Pro users
 * had no unlock cap enforced at all despite the spec defining 25/period
 * for Pro. This now calls getApplicationUnlocksRemaining() unconditionally,
 * which itself resolves the correct limit (including "no limit" for
 * Premium) from the user's actual plan.
 *
 * The unlock count is NOT a second counter for any plan: it's derived from
 * credit_transactions (see CreditRepository.countFeatureUsageSinceLastAllocation),
 * so there is exactly one authoritative record of every unlock.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { InternshipRepository } from "../db/repositories/internship.repository";
import { EngineError, NotFoundError } from "../utils/errors";
import {
  spendCreditsForFeature,
  getCurrentPlan,
  getApplicationUnlocksRemaining,
  getMonthlyApplicationUnlockAllowance,
  getFeatureCreditCost,
  InsufficientCreditsError,
  CREDIT_FEATURES,
} from "@/lib/credits";

/** Thrown when a user has used up their plan's monthly application-link
 * unlock allowance (Free: 5, Pro: 25 — never thrown for Premium, which has
 * no cap). Distinct from InsufficientCreditsError — this can fire even
 * with plenty of credits left, since the two limits are independent per
 * the Phase 4/5 spec. */
export class UnlockLimitReachedError extends EngineError {
  constructor(limit: number, planName: string) {
    super(
      "UNLOCK_LIMIT_REACHED",
      `You've used all ${limit} application unlocks included in the ${planName} plan this period. Upgrade for more unlocks.`,
      403,
      { limit, planName }
    );
  }
}

/** @deprecated Renamed to UnlockLimitReachedError now that the cap applies
 * to every plan, not just Free. Kept as an alias so any existing catch
 * block for the old name keeps compiling. */
export const FreeUnlockLimitReachedError = UnlockLimitReachedError;

export interface UnlockApplicationResult {
  internshipId: string;
  applyUrl: string;
  creditsSpent: number;
  /** Remaining unlocks under the user's plan this period. null = unlimited
   * (currently Premium). Never trust a client-cached copy of this — always
   * re-read it from the response of the next unlock call. */
  unlocksRemaining: number | null;
}

/**
 * The real, gated entry point for "apply to this internship." Viewing,
 * searching, filtering, and bookmarking an internship never call this —
 * only the actual moment a user unlocks the external application link.
 *
 * Throws FreeUnlockLimitReachedError or InsufficientCreditsError (both
 * carry a `.toJSON()`-friendly shape) before ever touching Gemini/the
 * repository if the user isn't eligible — Gemini isn't involved in this
 * feature at all, but the same "check before you spend" principle from
 * every other credit-gated feature applies here too.
 */
export async function unlockInternshipApplication(
  userId: string,
  internshipId: string
): Promise<UnlockApplicationResult> {
  const plan = await getCurrentPlan(userId);

  // Applies to every plan now, not just Free. For Premium,
  // getApplicationUnlocksRemaining() resolves to null (unlimited) and this
  // check is skipped entirely — never a magic large number standing in for
  // "unlimited".
  const remainingBeforeSpend = await getApplicationUnlocksRemaining(userId);
  if (remainingBeforeSpend !== null && remainingBeforeSpend <= 0) {
    const limit = plan ? getMonthlyApplicationUnlockAllowance(plan) ?? 0 : 0;
    throw new UnlockLimitReachedError(limit, plan?.name ?? "Free");
  }

  const repository = new InternshipRepository();
  const feature = CREDIT_FEATURES.INTERNSHIP_APPLICATION_UNLOCK;

  const cost = await getFeatureCreditCost(feature);
  if (!cost) {
    throw new EngineError(
      "UNLOCK_UNAVAILABLE",
      "Internship application unlocking is temporarily unavailable (no active credit cost configured).",
      503,
      { feature }
    );
  }

  let applyUrl: string;
  try {
    applyUrl = await spendCreditsForFeature(
      userId,
      cost.creditCost,
      feature,
      async () => {
        const internship = await repository.findById(internshipId);
        return internship.applyUrl;
      },
      `Internship application unlock (${internshipId})`
    );
  } catch (err) {
    if (err instanceof InsufficientCreditsError) throw err;
    if (err instanceof NotFoundError) throw err;
    throw new EngineError("UNLOCK_FAILED", "Failed to unlock this internship's application link.", 500, {
      internshipId,
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  // Reuses the EXISTING apply_count counter (InternshipRepository already
  // had this for the sync engine's own metrics) — not a new counter.
  // Best-effort: a failure here shouldn't undo a successful unlock the
  // user already paid for and received the URL for.
  await repository.incrementCounter(internshipId, "apply_count").catch(() => {});

  // Persist this unlock durably so it's visible again on any future page
  // load/session — previously the unlocked applyUrl only lived in the
  // client's in-memory query cache and reset on every reload. Same
  // best-effort pattern as the counter above: a failure here must never
  // undo an unlock the user already paid credits for.
  //
  // Two typing-only fixes here vs. the original, no logic change:
  //  1. `as unknown as SupabaseClient` — same pre-existing gap as
  //     lib/credits/credit.repository.ts: lib/supabase/types.ts hasn't
  //     been regenerated since internship_unlocks was added, so the typed
  //     client doesn't know this table exists yet.
  //  2. `Promise.resolve(...).catch(...)` instead of calling `.catch`
  //     directly on the query builder — Supabase's PostgrestFilterBuilder
  //     is PromiseLike but its type doesn't declare `.catch`, only
  //     `.then`/`.match`. Wrapping in Promise.resolve() gives a real
  //     Promise with `.catch` while awaiting the exact same call.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = (await createClient()) as unknown as SupabaseClient;
  await Promise.resolve(
    supabase
      .from("internship_unlocks")
      .upsert(
        { user_id: userId, internship_id: internshipId, apply_url: applyUrl },
        { onConflict: "user_id,internship_id" }
      )
  ).catch(() => {});

  // Re-read after the spend (not reused from remainingBeforeSpend) so the
  // returned count reflects the unlock that just happened, straight from
  // the ledger — never decremented client-side.
  const unlocksRemaining = await getApplicationUnlocksRemaining(userId);

  return {
    internshipId,
    applyUrl,
    creditsSpent: cost.creditCost,
    unlocksRemaining,
  };
}
