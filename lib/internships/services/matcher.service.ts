import type { InternshipRecord, MatchResult, UserProfileSnapshot } from '../types';
import { getAIRunner } from '../ai/engine.adapter';
import { buildMatchPrompt, MATCH_SYSTEM, type MatchOutput } from '../ai/prompts';
import { RecommendationRepository } from '../db/repositories';
import { RankingService } from './ranking.service';
import { createLogger } from '../utils/logger';
import { mapWithConcurrency } from '../utils/retry';
import { dedupeSkills } from '../utils/skills';
import { isoNow } from '../utils/date';
import { getEnv } from '../config/env';

const log = createLogger('internships.matcher');

const CACHE_MAX_AGE_HOURS = 72;

export class MatcherService {
  constructor(
    private readonly recommendations = new RecommendationRepository(),
    private readonly ranking = new RankingService(),
  ) {}

  /** Single match with a persisted-result cache. */
  async match(
    internship: InternshipRecord,
    profile: UserProfileSnapshot,
    options: { force?: boolean } = {},
  ): Promise<MatchResult> {
    if (!options.force) {
      const cached = await this.recommendations.find(profile.userId, internship.id, CACHE_MAX_AGE_HOURS);
      if (cached) return cached;
    }

    const result = await this.computeMatch(internship, profile);
    await this.recommendations.upsertMany([result]);
    return result;
  }

  /**
   * Batch match. Runs the cheap heuristic first and only sends the top candidates
   * to the model — the difference between ~10 AI calls and ~2,000 per user.
   */
  async matchMany(
    internships: readonly InternshipRecord[],
    profile: UserProfileSnapshot,
    options: { topN?: number; concurrency?: number } = {},
  ): Promise<MatchResult[]> {
    if (internships.length === 0) return [];
    const topN = options.topN ?? 25;

    const cached = await this.recommendations.findMany(
      profile.userId,
      internships.map((i) => i.id),
      CACHE_MAX_AGE_HOURS,
    );
    const cachedById = new Map(cached.map((c) => [c.internshipId, c]));

    const pending = internships
      .filter((item) => !cachedById.has(item.id))
      .map((item) => ({ item, heuristic: this.ranking.heuristicMatch(item, profile) }))
      .sort((a, b) => b.heuristic - a.heuristic);

    const toScore = pending.slice(0, topN);
    const skipped = pending.slice(topN);

    const results = await mapWithConcurrency(
      toScore,
      options.concurrency ?? 4,
      ({ item }) => this.computeMatch(item, profile),
    );

    const computed: MatchResult[] = [];
    results.forEach((result, index) => {
      const entry = toScore[index];
      if (!entry) return;
      if (result.ok) {
        computed.push(result.value);
      } else {
        log.warn('AI match failed; falling back to heuristic scoring', {
          internshipId: entry.item.id,
          error: (result.error as Error).message,
        });
        computed.push(this.heuristicOnlyResult(entry.item, profile, entry.heuristic));
      }
    });

    if (computed.length > 0) await this.recommendations.upsertMany(computed);

    const fallbacks = skipped.map(({ item, heuristic }) =>
      this.heuristicOnlyResult(item, profile, heuristic),
    );

    return [...cached, ...computed, ...fallbacks].sort(
      (a, b) => b.recommendationScore - a.recommendationScore,
    );
  }

  private async computeMatch(
    internship: InternshipRecord,
    profile: UserProfileSnapshot,
  ): Promise<MatchResult> {
    const runner = getAIRunner();
    const output = await runner.runJson<MatchOutput>(
      MATCH_SYSTEM,
      buildMatchPrompt(internship, profile),
      { feature: 'internship_match', userId: profile.userId, temperature: 0.15, maxOutputTokens: 2_048 },
    );

    const resumeMatch = clampScore(output.resumeMatch);
    const atsMatch = clampScore(output.atsMatch);
    const eligibilityScore = clampScore(output.eligibilityScore);
    const applicationReadiness = clampScore(output.applicationReadiness);
    const rankingScore = this.ranking.rankingScore(internship);

    return {
      internshipId: internship.id,
      userId: profile.userId,
      resumeMatch,
      atsMatch,
      eligibilityScore,
      applicationReadiness,
      rankingScore,
      recommendationScore: this.blend(resumeMatch, atsMatch, eligibilityScore, rankingScore),
      eligible: Boolean(output.eligible) && eligibilityScore >= 50,
      matchedSkills: dedupeSkills(output.matchedSkills ?? []),
      missingSkills: dedupeSkills(output.missingSkills ?? []),
      skillGaps: (output.skillGaps ?? []).slice(0, 8),
      explanation: {
        summary: output.explanation?.summary ?? '',
        strengths: (output.explanation?.strengths ?? []).slice(0, 5),
        gaps: (output.explanation?.gaps ?? []).slice(0, 5),
      },
      suggestedProjects: (output.suggestedProjects ?? []).slice(0, 3),
      suggestedCourses: (output.suggestedCourses ?? []).slice(0, 3),
      interviewPrep: (output.interviewPrep ?? []).slice(0, 5),
      model: getEnv().geminiModel,
      computedAt: isoNow(),
    };
  }

  /**
   * Composite recommendation score.
   * Resume fit dominates, but an ineligible posting can never rank highly
   * regardless of how well the skills line up.
   */
  private blend(resume: number, ats: number, eligibility: number, ranking: number): number {
    const fit = resume * 0.45 + ats * 0.20 + eligibility * 0.20 + ranking * 0.15;
    const eligibilityGate = eligibility < 50 ? 0.4 : 1;
    return Math.round(fit * eligibilityGate);
  }

  /** Used when the model is unavailable or a posting fell below the AI cutoff. */
  private heuristicOnlyResult(
    internship: InternshipRecord,
    profile: UserProfileSnapshot,
    heuristic: number,
  ): MatchResult {
    const matched = internship.skills.filter((s) =>
      profile.skills.some((p) => p.toLowerCase() === s.toLowerCase()));
    const missing = internship.skills.filter((s) =>
      !profile.skills.some((p) => p.toLowerCase() === s.toLowerCase()));

    const eligible = this.checkHardEligibility(internship, profile);
    const rankingScore = this.ranking.rankingScore(internship);

    return {
      internshipId: internship.id,
      userId: profile.userId,
      resumeMatch: heuristic,
      atsMatch: heuristic,
      eligibilityScore: eligible ? 80 : 30,
      applicationReadiness: Math.round(heuristic * 0.8),
      rankingScore,
      recommendationScore: this.blend(heuristic, heuristic, eligible ? 80 : 30, rankingScore),
      eligible,
      matchedSkills: matched,
      missingSkills: missing.slice(0, 10),
      skillGaps: missing.slice(0, 5).map((skill) => ({
        skill,
        importance: 'important' as const,
        reason: 'Listed in the posting but not found on your profile.',
      })),
      explanation: {
        summary: 'Scored from profile signals. Open this internship for a full AI breakdown.',
        strengths: matched.slice(0, 3).map((s) => `You already have ${s}.`),
        gaps: missing.slice(0, 3).map((s) => `${s} is required but not on your profile.`),
      },
      suggestedProjects: [],
      suggestedCourses: [],
      interviewPrep: [],
      model: 'heuristic',
      computedAt: isoNow(),
    };
  }

  private checkHardEligibility(item: InternshipRecord, profile: UserProfileSnapshot): boolean {
    if (item.eligibility.minCgpa !== null && profile.cgpa !== null && profile.cgpa < item.eligibility.minCgpa) {
      return false;
    }
    if (
      item.eligibility.years.length > 0 &&
      profile.graduationYear !== null &&
      !item.eligibility.years.includes(profile.graduationYear)
    ) {
      return false;
    }
    if (
      item.eligibility.branches.length > 0 &&
      profile.branch !== null &&
      !item.eligibility.branches.some((b) => b.toLowerCase() === profile.branch?.toLowerCase())
    ) {
      return false;
    }
    return true;
  }
}

function clampScore(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(Math.min(100, Math.max(0, parsed)));
}
