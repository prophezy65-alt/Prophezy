/**
 * lib/credits/types.ts
 *
 * Types for the central credit system (supabase/migrations/20260813120*_credit_system_*.sql).
 * These mirror the DB shapes directly. Once you run
 * `npx supabase gen types typescript --linked > lib/supabase/types.ts`, the
 * Row types below can be replaced with
 * `Database["public"]["Tables"]["credit_balances"]["Row"]` etc. — they're
 * hand-written here only because the new tables aren't in that generated
 * file yet.
 */

export type PlanId = "free" | "pro" | "premium";

export type CreditTransactionType =
  | "monthly_allocation"
  | "usage"
  | "refund"
  | "bonus"
  | "admin_adjustment";

export interface Plan {
  id: PlanId;
  name: string;
  priceInr: number;
  monthlyCredits: number;
  isActive: boolean;
  features: Record<string, unknown>;
}

/**
 * Typed view over Plan.features (Phase 5). monthlyApplicationUnlocks is
 * `null` for Premium — an explicit "no cap" signal (see the Phase 5
 * migration), never an arbitrary large integer. Read via
 * getMonthlyApplicationUnlockAllowance(plan) in credit.service.ts rather
 * than indexing plan.features directly, so every caller agrees on the
 * same fallback behavior for a plan row that predates this key.
 */
export interface PlanFeatures {
  monthlyApplicationUnlocks: number | null;
  unlimitedApplicationUnlocks?: boolean;
}

/**
 * The single authoritative "what can this user do" snapshot. This is the
 * shape Settings, the internship-unlock gate, and any future plan-gated
 * feature should all read instead of re-deriving plan/credit/unlock logic
 * themselves. See lib/credits/entitlements.service.ts#getEntitlements.
 */
export interface Entitlements {
  userId: string;
  plan: Plan;
  subscriptionStatus: CreditSummary["subscriptionStatus"];
  creditsRemaining: number;
  creditsUsedThisPeriod: number;
  monthlyCreditAllowance: number;
  /** null = unlimited (Premium today). Never 0 meaning unlimited. */
  applicationUnlockAllowance: number | null;
  /** null = unlimited. Otherwise >= 0, derived from the ledger — never a
   * client-trusted counter. */
  applicationUnlocksRemaining: number | null;
}

export interface CreditBalance {
  userId: string;
  balance: number;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: CreditTransactionType;
  feature: string;
  description: string | null;
  createdAt: string;
}

/** One row from public.credit_summary — the single source of truth Settings
 * (or any other feature) should read for "what plan / how many credits". */
export interface CreditSummary {
  userId: string;
  planId: PlanId;
  planName: string;
  monthlyCredits: number;
  creditsRemaining: number;
  creditsUsedThisPeriod: number;
  usagePercentage: number;
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "none";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  balanceUpdatedAt: string;
}

export interface FeatureCreditCost {
  feature: string;
  creditCost: number;
  isActive: boolean;
  description: string | null;
}

export interface GetCreditUsageOptions {
  limit?: number;
  feature?: string;
}
