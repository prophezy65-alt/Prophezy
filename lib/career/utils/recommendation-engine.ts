/**
 * recommendation-engine.ts
 * Post-processing for AI-generated recommendations: dedupe near-identical
 * titles, clamp confidence scores, and rank. Keeps the AI's job narrow
 * (generate candidates) while this module enforces consistency.
 */

import { Recommendation, RecommendationType } from "../models/career.model";

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupeRecommendations(recommendations: Recommendation[]): Recommendation[] {
  const seen = new Map<string, Recommendation>();

  for (const rec of recommendations) {
    const key = `${rec.type}:${normalizeTitle(rec.title)}`;
    const existing = seen.get(key);
    if (!existing || rec.confidenceScore > existing.confidenceScore) {
      seen.set(key, rec);
    }
  }

  return [...seen.values()];
}

export function rankRecommendations(recommendations: Recommendation[]): Recommendation[] {
  return [...recommendations].sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export function clampConfidenceScores(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.map((r) => ({
    ...r,
    confidenceScore: Math.max(0, Math.min(100, Math.round(r.confidenceScore))),
  }));
}

/**
 * Full post-processing pipeline: clamp -> dedupe -> rank -> limit.
 */
export function processRecommendations(recommendations: Recommendation[], limit = 10): Recommendation[] {
  const clamped = clampConfidenceScores(recommendations);
  const deduped = dedupeRecommendations(clamped);
  const ranked = rankRecommendations(deduped);
  return ranked.slice(0, limit);
}

export function filterRecommendationsByType(
  recommendations: Recommendation[],
  type: RecommendationType
): Recommendation[] {
  return recommendations.filter((r) => r.type === type);
}
