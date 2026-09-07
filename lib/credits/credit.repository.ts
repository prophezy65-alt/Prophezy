/**
 * lib/credits/credit.repository.ts
 *
 * Thin data-access layer over the credit_system tables/functions/view.
 * Follows the same shape as lib/settings/repository/settings.repository.ts
 * (a class wrapping a SupabaseClient) so the two modules feel consistent.
 *
 * IMPORTANT — which client to pass in:
 *   - Methods that read/write on behalf of "the current user" (getBalance,
 *     getSummary, getUsage, spend, canSpend) MUST be called with a
 *     request-scoped client from `createClient()` (lib/supabase/server.ts),
 *     i.e. the cookie-bound client carrying the caller's own session. RLS
 *     and the spend_credits/can_spend_credits functions both key off
 *     auth.uid() from that session — passing the admin client here would
 *     defeat the "own row only" guarantee.
 *   - Methods that increase a balance (addCredits, allocateMonthlyCredits)
 *     MUST be called with the service-role client from
 *     `createAdminClient()` / `createServiceRoleClient()`
 *     (lib/supabase/admin.ts / service-role.ts). The underlying Postgres
 *     functions are REVOKEd from `authenticated` — calling them with a
 *     regular user session will fail with a permission-denied error, by
 *     design.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { InsufficientCreditsError, CreditSystemError } from "./errors";
import type {
  CreditBalance,
  CreditSummary,
  CreditTransaction,
  CreditTransactionType,
  FeatureCreditCost,
  GetCreditUsageOptions,
  Plan,
} from "./types";

// See the note in types.ts — swap to SupabaseClient<Database> once
// `supabase gen types` has been re-run and includes the new tables.
type DB = SupabaseClient;

export class CreditRepository {
  constructor(private readonly db: DB) {}

  // -- reads ------------------------------------------------------------

  /** The caller's own balance. Requires a request-scoped (user-session) client. */
  async getBalance(userId: string): Promise<CreditBalance | null> {
    const { data, error } = await this.db
      .from("credit_balances")
      .select("user_id, balance, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new CreditSystemError("Failed to load credit balance", error);
    if (!data) return null;
    return { userId: data.user_id, balance: data.balance, updatedAt: data.updated_at };
  }

  /** The full plan + balance + usage snapshot from public.credit_summary.
   *
   * MONTHLY RESET FIX: calls public.get_credit_summary() (RPC) instead of
   * selecting the view directly. That RPC runs
   * public.ensure_own_current_period() first, which is a no-op unless the
   * caller's billing period has actually elapsed, in which case it resets
   * the balance to the current plan's allowance before this read happens —
   * see 20260906090000_credit_system_monthly_reset.sql. Without this, a
   * page load in a new month would show whatever (possibly zero) balance
   * was left over from the previous period until something else happened
   * to trigger a reset. */
  async getSummary(_userId: string): Promise<CreditSummary | null> {
    // _userId kept for signature compatibility with existing callers;
    // get_credit_summary() resolves auth.uid() internally (self-service,
    // same pattern as spend()/canSpend() below) and can only ever return
    // the caller's own row.
    const { data, error } = await this.db.rpc("get_credit_summary");
    if (error) throw new CreditSystemError("Failed to load credit summary", error);
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      userId: row.user_id as string,
      planId: row.plan_id as CreditSummary["planId"],
      planName: row.plan_name as string,
      monthlyCredits: row.monthly_credits as number,
      creditsRemaining: row.credits_remaining as number,
      creditsUsedThisPeriod: row.credits_used_this_period as number,
      usagePercentage: Number(row.usage_percentage),
      subscriptionStatus: row.subscription_status as CreditSummary["subscriptionStatus"],
      currentPeriodStart: row.current_period_start as string | null,
      currentPeriodEnd: row.current_period_end as string | null,
      balanceUpdatedAt: row.balance_updated_at as string,
    };
  }

  /** Runs the same monthly-period check getSummary()/spend()/canSpend()
   * already trigger internally, without needing a balance/summary read —
   * used by callers (e.g. getApplicationUnlocksRemaining, which reads
   * credit_transactions directly rather than through credit_summary) that
   * need the guarantee on its own. Idempotent, safe to call as often as
   * needed; a no-op unless the caller's period has actually elapsed. */
  async ensureCurrentPeriod(): Promise<void> {
    const { error } = await this.db.rpc("ensure_own_current_period");
    if (error) throw new CreditSystemError("Failed to check billing period", error);
  }

  async getCurrentPlan(userId: string): Promise<Plan | null> {
    // Two-step lookup rather than a PostgREST embedded-resource join:
    // subscriptions.plan_tier is a public.plan_tier ENUM and plans.id is
    // TEXT, so there is no real FK constraint between them for PostgREST
    // to introspect (see the tables migration comment on why plan_tier
    // wasn't itself converted to an FK). Both queries hit tables with a
    // public-read policy, so no extra RLS concern either way.
    const { data: sub, error: subError } = await this.db
      .from("subscriptions")
      .select("plan_tier")
      .eq("user_id", userId)
      .maybeSingle();
    if (subError) throw new CreditSystemError("Failed to load subscription", subError);

    const planId = sub?.plan_tier ?? "free";

    const { data: plan, error: planError } = await this.db
      .from("plans")
      .select("id, name, price_inr, monthly_credits, is_active, features")
      .eq("id", planId)
      .maybeSingle();
    if (planError) throw new CreditSystemError("Failed to load plan", planError);
    if (!plan) return null;

    return {
      id: plan.id as Plan["id"],
      name: plan.name,
      priceInr: Number(plan.price_inr),
      monthlyCredits: plan.monthly_credits,
      isActive: plan.is_active,
      features: (plan.features as Record<string, unknown>) ?? {},
    };
  }

  async getUsage(userId: string, opts: GetCreditUsageOptions = {}): Promise<CreditTransaction[]> {
    let query = this.db
      .from("credit_transactions")
      .select("id, user_id, amount, type, feature, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 50);
    if (opts.feature) query = query.eq("feature", opts.feature);

    const { data, error } = await query;
    if (error) throw new CreditSystemError("Failed to load credit transactions", error);
    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      type: row.type,
      feature: row.feature,
      description: row.description,
      createdAt: row.created_at,
    }));
  }

  async getFeatureCreditCost(feature: string): Promise<FeatureCreditCost | null> {
    const { data, error } = await this.db
      .from("feature_credit_costs")
      .select("feature, credit_cost, is_active, description")
      .eq("feature", feature)
      .maybeSingle();
    if (error) throw new CreditSystemError("Failed to load feature credit cost", error);
    if (!data) return null;
    return {
      feature: data.feature,
      creditCost: data.credit_cost,
      isActive: data.is_active,
      description: data.description,
    };
  }

  /**
   * Counts how many times `feature` has been spent (type='usage') since
   * the caller's most recent monthly_allocation transaction. Used for
   * Phase 4's "5 free application-link unlocks per period" rule WITHOUT a
   * second counter table — the existing credit_transactions ledger is
   * already the one authoritative record of every unlock (each is a
   * normal usage transaction with feature=INTERNSHIP_APPLICATION_UNLOCK),
   * so this derives the count from it instead of tracking it twice. It
   * also means the count naturally resets whenever
   * allocate_monthly_credits() next runs for this user — same reset
   * trigger as the credit balance itself, no separate scheduling needed.
   */
  async countFeatureUsageSinceLastAllocation(userId: string, feature: string): Promise<number> {
    const { data: lastAllocation, error: allocError } = await this.db
      .from("credit_transactions")
      .select("created_at")
      .eq("user_id", userId)
      .eq("type", "monthly_allocation")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (allocError) throw new CreditSystemError("Failed to resolve current allocation period", allocError);

    // No allocation on record (shouldn't happen post-signup, but fail
    // open to "count everything" rather than throw — undercounting the
    // limit is the safe direction, not overcounting).
    const since = lastAllocation?.created_at ?? "1970-01-01T00:00:00Z";

    const { count, error: countError } = await this.db
      .from("credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", feature)
      .eq("type", "usage")
      .gte("created_at", since);
    if (countError) throw new CreditSystemError("Failed to count feature usage", countError);

    return count ?? 0;
  }

  // -- self-service mutations (user-session client) ----------------------

  /** Atomic debit. Throws InsufficientCreditsError (populated with the
   * actual remaining balance and the amount requested — never thrown
   * empty) if the caller doesn't have enough balance; the DB-side function
   * guarantees this never leaves the balance negative under concurrent
   * calls. */
  async spend(amount: number, feature: string, description?: string): Promise<CreditBalance> {
    const { data, error } = await this.db.rpc("spend_credits", {
      p_amount: amount,
      p_feature: feature,
      p_description: description ?? null,
    });
    if (error) {
      if (error.code === "P0001") {
        // spend_credits raises DETAIL = 'balance=<n> requested=<n>' (see
        // the migration) — parse the real balance PostgREST surfaces on
        // `error.details` rather than re-querying (avoids a second round
        // trip and any race between the failed spend and a fresh read).
        // `requested` we already have as the `amount` argument, but we
        // still prefer the DB's own echo of it when present for a single
        // source of truth.
        const match = /balance=(\d+)\s+requested=(\d+)/.exec((error as { details?: string }).details ?? "");
        const balance = match ? Number(match[1]) : undefined;
        const requested = match ? Number(match[2]) : amount;
        throw new InsufficientCreditsError(
          `Not enough credits for ${feature}.`,
          { feature, balance, requested }
        );
      }
      throw new CreditSystemError("Failed to spend credits", error);
    }
    const row = data as { user_id: string; balance: number; updated_at: string };
    return { userId: row.user_id, balance: row.balance, updatedAt: row.updated_at };
  }

  async canSpend(amount: number): Promise<boolean> {
    const { data, error } = await this.db.rpc("can_spend_credits", { p_amount: amount });
    if (error) throw new CreditSystemError("Failed to check credit balance", error);
    return Boolean(data);
  }

  // -- privileged mutations (service-role client ONLY) -------------------

  /** Increases a balance. type='usage' is rejected by the DB function —
   * use spend() for debits. Requires a service-role client; will fail with
   * a permission error otherwise (see class doc comment above). */
  async add(
    userId: string,
    amount: number,
    type: Exclude<CreditTransactionType, "usage">,
    feature = "system",
    description?: string,
  ): Promise<CreditBalance> {
    const { data, error } = await this.db.rpc("add_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_feature: feature,
      p_description: description ?? null,
    });
    if (error) throw new CreditSystemError("Failed to add credits", error);
    const row = data as { user_id: string; balance: number; updated_at: string };
    return { userId: row.user_id, balance: row.balance, updatedAt: row.updated_at };
  }

  /** Resets the user's balance to their current plan's monthly allowance.
   * Requires a service-role client. See the migration comment for how this
   * is meant to be triggered once real billing periods exist. */
  async allocateMonthly(userId: string): Promise<CreditBalance> {
    const { data, error } = await this.db.rpc("allocate_monthly_credits", { p_user_id: userId });
    if (error) throw new CreditSystemError("Failed to allocate monthly credits", error);
    const row = data as { user_id: string; balance: number; updated_at: string };
    return { userId: row.user_id, balance: row.balance, updatedAt: row.updated_at };
  }
}
