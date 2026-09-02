import { getServiceClient } from '../client';
import { EngineError } from '../../utils/errors';
import type { MatchResult } from '../../types';

interface MatchRow {
  user_id: string;
  internship_id: string;
  resume_match: number;
  ats_match: number;
  eligibility_score: number;
  application_readiness: number;
  ranking_score: number;
  recommendation_score: number;
  eligible: boolean;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  skill_gaps: unknown;
  explanation: unknown;
  suggested_projects: string[] | null;
  suggested_courses: string[] | null;
  interview_prep: string[] | null;
  model: string;
  computed_at: string;
}

export class RecommendationRepository {
  private get db() {
    return getServiceClient();
  }

  async upsertMany(results: readonly MatchResult[]): Promise<void> {
    if (results.length === 0) return;
    const { error } = await this.db.from('recommendations').upsert(
      results.map((r) => ({
        user_id: r.userId,
        internship_id: r.internshipId,
        resume_match: r.resumeMatch,
        ats_match: r.atsMatch,
        eligibility_score: r.eligibilityScore,
        application_readiness: r.applicationReadiness,
        ranking_score: r.rankingScore,
        recommendation_score: r.recommendationScore,
        eligible: r.eligible,
        matched_skills: r.matchedSkills,
        missing_skills: r.missingSkills,
        skill_gaps: r.skillGaps,
        explanation: r.explanation,
        suggested_projects: r.suggestedProjects,
        suggested_courses: r.suggestedCourses,
        interview_prep: r.interviewPrep,
        model: r.model,
        computed_at: r.computedAt,
      })),
      { onConflict: 'user_id,internship_id' },
    );
    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
  }

  async find(userId: string, internshipId: string, maxAgeHours: number): Promise<MatchResult | null> {
    const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString();
    const { data, error } = await this.db
      .from('recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('internship_id', internshipId)
      .gte('computed_at', cutoff)
      .maybeSingle();
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return data ? rowToMatch(data as MatchRow) : null;
  }

  async findMany(userId: string, internshipIds: readonly string[], maxAgeHours: number): Promise<MatchResult[]> {
    if (internshipIds.length === 0) return [];
    const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString();
    const { data, error } = await this.db
      .from('recommendations')
      .select('*')
      .eq('user_id', userId)
      .in('internship_id', internshipIds as string[])
      .gte('computed_at', cutoff);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as MatchRow[]).map(rowToMatch);
  }

  async topForUser(userId: string, limit: number): Promise<MatchResult[]> {
    const { data, error } = await this.db
      .from('recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('eligible', true)
      .order('recommendation_score', { ascending: false })
      .limit(limit);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as MatchRow[]).map(rowToMatch);
  }
}

function rowToMatch(row: MatchRow): MatchResult {
  const explanation = (row.explanation ?? {}) as Partial<MatchResult['explanation']>;
  return {
    userId: row.user_id,
    internshipId: row.internship_id,
    resumeMatch: row.resume_match,
    atsMatch: row.ats_match,
    eligibilityScore: row.eligibility_score,
    applicationReadiness: row.application_readiness,
    rankingScore: row.ranking_score,
    recommendationScore: row.recommendation_score,
    eligible: row.eligible,
    matchedSkills: row.matched_skills ?? [],
    missingSkills: row.missing_skills ?? [],
    skillGaps: Array.isArray(row.skill_gaps) ? (row.skill_gaps as MatchResult['skillGaps']) : [],
    explanation: {
      summary: explanation.summary ?? '',
      strengths: explanation.strengths ?? [],
      gaps: explanation.gaps ?? [],
    },
    suggestedProjects: row.suggested_projects ?? [],
    suggestedCourses: row.suggested_courses ?? [],
    interviewPrep: row.interview_prep ?? [],
    model: row.model,
    computedAt: row.computed_at,
  };
}
