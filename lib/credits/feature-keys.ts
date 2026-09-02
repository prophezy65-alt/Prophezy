/**
 * lib/credits/feature-keys.ts
 *
 * The canonical, final set of feature keys for the central credit system
 * (Phase 4). These MUST match public.feature_credit_costs.feature exactly
 * — see supabase/migrations/20260815090000_credit_system_phase4_final_economy.sql.
 *
 * Every call to spendCreditsForFeature() / getFeatureCreditCost() should
 * use one of these constants, never a raw string literal — a typo'd
 * literal silently fails getFeatureCreditCost() (returns null -> the
 * calling feature throws "temporarily unavailable" instead of charging
 * the wrong amount, which is the safe failure mode, but still avoidable).
 */

export const CREDIT_FEATURES = {
  PROPHEZY_AI_QUESTION: "PROPHEZY_AI_QUESTION",
  AI_NOTE_GENERATION: "AI_NOTE_GENERATION",
  EXAM_PREDICTOR: "EXAM_PREDICTOR",
  RESUME_AI_ANALYSIS: "RESUME_AI_ANALYSIS",
  INTERVIEW_AI_ACTION: "INTERVIEW_AI_ACTION",
  RESEARCH_PAPER_AI_QUERY: "RESEARCH_PAPER_AI_QUERY",
  CAREER_GUIDANCE_AI: "CAREER_GUIDANCE_AI",
  INTERNSHIP_APPLICATION_UNLOCK: "INTERNSHIP_APPLICATION_UNLOCK",
} as const;

export type CreditFeatureKey = (typeof CREDIT_FEATURES)[keyof typeof CREDIT_FEATURES];
