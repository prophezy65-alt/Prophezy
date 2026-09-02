/**
 * recommendation-postprocess.ts
 * Post-processing for hackathon recommendations: dedupe by hackathon id,
 * clamp confidence scores, and rank — mirrors the pattern used in the
 * Career Guidance module for consistency.
 */

import { HackathonRecommendation } from "../models/hackathon.model";

export function dedupeRecommendations(recommendations: HackathonRecommendation[]): HackathonRecommendation[] {
  const seen = new Map<string, HackathonRecommendation>();
  for (const rec of recommendations) {
    const existing = seen.get(rec.hackathonId);
    if (!existing || rec.confidenceScore > existing.confidenceScore) {
      seen.set(rec.hackathonId, rec);
    }
  }
  return [...seen.values()];
}

export function clampConfidenceScores(recommendations: HackathonRecommendation[]): HackathonRecommendation[] {
  return recommendations.map((r) => ({ ...r, confidenceScore: Math.max(0, Math.min(100, Math.round(r.confidenceScore))) }));
}

export function rankRecommendations(recommendations: HackathonRecommendation[]): HackathonRecommendation[] {
  return [...recommendations].sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export function processRecommendations(recommendations: HackathonRecommendation[], limit = 10): HackathonRecommendation[] {
  return rankRecommendations(dedupeRecommendations(clampConfidenceScores(recommendations))).slice(0, limit);
}
