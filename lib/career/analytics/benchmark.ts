/**
 * benchmark.ts
 * Lightweight benchmarking helpers: compares a student's scores against
 * rough baseline bands so the dashboard can show "you're ahead of a
 * typical fresher for this role" style context. Deterministic, no AI call.
 */

export type BenchmarkTier = "beginner" | "developing" | "competitive" | "strong" | "exceptional";

const TIER_THRESHOLDS: [number, BenchmarkTier][] = [
  [90, "exceptional"],
  [75, "strong"],
  [55, "competitive"],
  [35, "developing"],
  [0, "beginner"],
];

export function scoreToTier(score: number): BenchmarkTier {
  for (const [threshold, tier] of TIER_THRESHOLDS) {
    if (score >= threshold) return tier;
  }
  return "beginner";
}

export interface BenchmarkResult {
  score: number;
  tier: BenchmarkTier;
  description: string;
}

const TIER_DESCRIPTIONS: Record<BenchmarkTier, string> = {
  exceptional: "Top tier — ready to compete for highly selective roles.",
  strong: "Well above average — a strong candidate for most target roles.",
  competitive: "On par with typical successful applicants — keep building.",
  developing: "Making progress — focus on the highest-priority gaps first.",
  beginner: "Early stage — a focused roadmap will move this quickly.",
};

export function benchmarkScore(score: number): BenchmarkResult {
  const tier = scoreToTier(score);
  return { score, tier, description: TIER_DESCRIPTIONS[tier] };
}

/**
 * Benchmarks a set of named scores (e.g. { skillScore, readinessScore }) in
 * one call for dashboard convenience.
 */
export function benchmarkScores(scores: Record<string, number>): Record<string, BenchmarkResult> {
  return Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, benchmarkScore(value)]));
}
