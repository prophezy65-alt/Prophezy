/**
 * lib/ai/services/resume.service.ts
 *
 * Credit-gated in Phase 4: RESUME_AI_ANALYSIS (5 credits), looked up
 * centrally from public.feature_credit_costs rather than hardcoded here.
 * Spend happens BEFORE runStructured() (before Gemini is ever called);
 * automatically refunded if generation fails, via spendCreditsForFeature.
 */
import { runStructured } from "./_run-structured";
import { RESUME_PROMPT, type ResumeBuildInput, type ResumeBuildOutput } from "../prompts/resume";
import { spendCreditsForFeature, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";

export async function buildResume(
  userId: string,
  input: ResumeBuildInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<ResumeBuildOutput> {
  const feature = CREDIT_FEATURES.RESUME_AI_ANALYSIS;
  const cost = await getFeatureCreditCost(feature);
  if (!cost) {
    throw new Error(`Resume AI is temporarily unavailable (no active credit cost configured for "${feature}").`);
  }

  return spendCreditsForFeature(
    userId,
    cost.creditCost,
    feature,
    () => runStructured(RESUME_PROMPT, { userId, input, ...opts }),
    "Resume AI analysis"
  );
}
