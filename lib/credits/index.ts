/**
 * lib/credits/index.ts
 * Public entry point for the central credit system. Import from "@/lib/credits".
 */

export * from "./types";
export * from "./errors";
export * from "./feature-keys";
export {
  getCreditBalance,
  getCurrentPlan,
  getFreeApplicationUnlocksRemaining,
  getApplicationUnlocksRemaining,
  getMonthlyApplicationUnlockAllowance,
  getCreditSummary,
  getCreditUsage,
  canSpendCredits,
  getFeatureCreditCost,
  spendCredits,
  spendCreditsForFeature,
  spendCreditsForStreamingFeature,
  addCreditsAdmin,
  refundCredits,
  allocateMonthlyCredits,
} from "./credit.service";
export { CreditRepository } from "./credit.repository";
export { getEntitlements, hasFeatureAccess } from "./entitlements.service";
export { setUserPlan } from "./admin-plan.service";
