/**
 * ranking-engine.ts
 * Composite ranking combining skill match, theme match, difficulty fit,
 * prize attractiveness, and urgency into one ordering — the core of
 * "Personalized Ranking". Entirely deterministic; AI-based recommendation
 * rationale is layered on top in recommendation.service.ts.
 */

import { Hackathon, HackathonUserProfile, HackathonMatchScore } from "../models/hackathon.model";
import { calculateThemeMatchPercent } from "./theme-analyzer";
import { calculateTechnologyMatchPercent } from "./technology-analyzer";
import { calculatePrizeScore } from "./prize-analyzer";
import { calculateUrgency } from "./timeline-calculator";
import { estimateDifficultyDeterministic } from "./difficulty-calculator";

const TIER_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function calculateDifficultyFitPercent(hackathon: Hackathon, profile: HackathonUserProfile): number {
  const estimate = estimateDifficultyDeterministic(hackathon);
  const distance = Math.abs(TIER_ORDER[estimate.tier]! - TIER_ORDER[profile.experienceTier]!);
  // 0 distance -> 100%, 1 -> 60%, 2 -> 20%
  return Math.max(20, 100 - distance * 40);
}

function checkEligibility(hackathon: Hackathon, profile: HackathonUserProfile): { ok: boolean; notes: string[] } {
  const notes: string[] = [];

  if (profile.preferredMode && hackathon.mode !== profile.preferredMode) {
    notes.push(`This hackathon is ${hackathon.mode}, but you prefer ${profile.preferredMode}.`);
  }

  if (
    profile.preferredCountries.length &&
    hackathon.country &&
    !profile.preferredCountries.some((c) => c.toLowerCase() === hackathon.country!.toLowerCase()) &&
    hackathon.mode !== "online"
  ) {
    notes.push(`This hackathon is location-restricted to ${hackathon.country}, outside your preferred countries.`);
  }

  return { ok: notes.length === 0, notes };
}

export function calculateMatchScore(hackathon: Hackathon, profile: HackathonUserProfile): HackathonMatchScore {
  const skillMatchPercent = calculateTechnologyMatchPercent(hackathon, profile);
  const themeMatchPercent = calculateThemeMatchPercent(hackathon, profile);
  const difficultyFitPercent = calculateDifficultyFitPercent(hackathon, profile);
  const eligibility = checkEligibility(hackathon, profile);

  const overallMatchPercent = Math.round(
    skillMatchPercent * 0.4 + themeMatchPercent * 0.35 + difficultyFitPercent * 0.25
  );

  return {
    hackathonId: hackathon.id,
    overallMatchPercent,
    skillMatchPercent,
    themeMatchPercent,
    difficultyFitPercent,
    eligibilityOk: eligibility.ok,
    eligibilityNotes: eligibility.notes,
  };
}

export interface RankedHackathon {
  hackathon: Hackathon;
  matchScore: HackathonMatchScore;
  rankScore: number;
}

/**
 * Full personalized ranking: match score blended with prize
 * attractiveness and a mild urgency boost (closing-soon hackathons that
 * are still a good match get surfaced higher so users don't miss them).
 */
export function rankHackathons(hackathons: Hackathon[], profile: HackathonUserProfile): RankedHackathon[] {
  return hackathons
    .map((hackathon) => {
      const matchScore = calculateMatchScore(hackathon, profile);
      const prizeScore = calculatePrizeScore(hackathon.prizes);
      const urgency = calculateUrgency(hackathon.timeline.submissionDeadline);
      const urgencyBoost = urgency === "soon" ? 5 : urgency === "urgent" ? 8 : 0;
      const eligibilityPenalty = matchScore.eligibilityOk ? 0 : 25;

      const rankScore =
        matchScore.overallMatchPercent * 0.7 + prizeScore * 0.2 + urgencyBoost - eligibilityPenalty;

      return { hackathon, matchScore, rankScore: Math.round(rankScore) };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
}
