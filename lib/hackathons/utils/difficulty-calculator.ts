/**
 * difficulty-calculator.ts
 * Deterministic difficulty estimation based on structural signals
 * (eligibility, prize size, evaluation criteria count, team size). Used as
 * the fast/free signal and as a fallback if the AI Core difficulty
 * estimate call fails or is skipped.
 */

import { Hackathon, ExperienceTier, DifficultyEstimate } from "../models/hackathon.model";

export function estimateDifficultyDeterministic(hackathon: Hackathon): DifficultyEstimate {
  if (hackathon.experienceTier.length === 1) {
    return {
      tier: hackathon.experienceTier[0]!,
      confidence: "high",
      rationale: `Source explicitly labels this hackathon as ${hackathon.experienceTier[0]} level.`,
    };
  }

  let score = 0;
  if ((hackathon.prizes.totalPoolUsd ?? 0) > 20000) score += 2;
  if ((hackathon.evaluationCriteria?.length ?? 0) > 5) score += 1;
  if (hackathon.eligibility.includes("professional")) score += 1;
  if ((hackathon.technologies?.length ?? 0) > 6) score += 1;

  const tier: ExperienceTier = score >= 3 ? "advanced" : score >= 1 ? "intermediate" : "beginner";

  return {
    tier,
    confidence: "medium",
    rationale: `Estimated from prize pool size, evaluation criteria complexity, and eligibility signals (score: ${score}).`,
  };
}
