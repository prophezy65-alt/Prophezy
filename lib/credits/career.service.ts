/**
 * lib/ai/services/career.service.ts
 *
 * Credit-gated in Phase 4: CAREER_GUIDANCE_AI (2 credits). This feature
 * had no row in feature_credit_costs before Phase 4's migration — it does
 * now, added specifically so this could be connected.
 */
import { runStructured } from "./_run-structured";
import { CAREER_PROMPT, type CareerInput, type CareerOutput } from "../prompts/career";
import { spendCreditsForFeature, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";

export async function getCareerAdvice(
  userId: string,
  input: CareerInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<CareerOutput> {
  const feature = CREDIT_FEATURES.CAREER_GUIDANCE_AI;
  const cost = await getFeatureCreditCost(feature);
  if (!cost) {
    throw new Error(`Career Guidance AI is temporarily unavailable (no active credit cost configured for "${feature}").`);
  }

  return spendCreditsForFeature(
    userId,
    cost.creditCost,
    feature,
    () => runStructured(CAREER_PROMPT, { userId, input, ...opts }),
    "Career guidance AI request"
  );
}
