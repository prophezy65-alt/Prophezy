/**
 * lib/interview/analytics/analytics.service.ts
 *
 * Takes a SupabaseClient as a parameter rather than importing one directly.
 * Wire it up in API routes with whatever server client Prophezy already
 * uses (e.g. `createServerClient()` from lib/supabase/server.ts) — that
 * file wasn't provided, so this stays decoupled instead of guessing an
 * import path that might not compile.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsSnapshot, SkillScore } from "../models/interview.model";

export interface RecordAttemptParams {
  userId: string;
  sessionId: string;
  overallScore: number;
  topicScores: SkillScore[];
}

export async function recordAttempt(db: SupabaseClient, params: RecordAttemptParams): Promise<void> {
  const { error } = await db.from("interview_skill_scores").insert(
    params.topicScores.map((s) => ({
      session_id: params.sessionId,
      user_id: params.userId,
      skill: s.skill,
      score: s.score,
    }))
  );
  if (error) throw new Error(`recordAttempt: failed to insert skill scores — ${error.message}`);
}

export async function computeAnalyticsSnapshot(
  db: SupabaseClient,
  userId: string
): Promise<AnalyticsSnapshot> {
  const { data: sessions, error: sessionsError } = await db
    .from("interview_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "completed");
  if (sessionsError) throw new Error(`computeAnalyticsSnapshot: ${sessionsError.message}`);

  const { data: evaluations, error: evalError } = await db
    .from("interview_evaluations")
    .select("overall_score, interview_answers!inner(session_id, interview_questions!inner(topic))")
    .in("interview_answers.session_id", (sessions ?? []).map((s) => s.id));
  if (evalError) throw new Error(`computeAnalyticsSnapshot: ${evalError.message}`);

  const { data: skillRows, error: skillError } = await db
    .from("interview_skill_scores")
    .select("skill, score")
    .eq("user_id", userId);
  if (skillError) throw new Error(`computeAnalyticsSnapshot: ${skillError.message}`);

  const rows = evaluations ?? [];
  const averageScore =
    rows.length > 0
      ? Math.round((rows.reduce((sum: number, r: any) => sum + r.overall_score, 0) / rows.length) * 10) / 10
      : 0;

  const topicTotals = new Map<string, { sum: number; count: number }>();
  for (const r of rows as any[]) {
    const topic = r.interview_answers?.interview_questions?.topic ?? "unknown";
    const entry = topicTotals.get(topic) ?? { sum: 0, count: 0 };
    entry.sum += r.overall_score;
    entry.count += 1;
    topicTotals.set(topic, entry);
  }
  const topicScores: SkillScore[] = Array.from(topicTotals.entries()).map(([skill, { sum, count }]) => ({
    skill,
    score: Math.round((sum / count) * 10) / 10,
  }));

  const skillScoreMap = new Map<string, number[]>();
  for (const row of (skillRows ?? []) as { skill: string; score: number }[]) {
    const list = skillScoreMap.get(row.skill) ?? [];
    list.push(row.score);
    skillScoreMap.set(row.skill, list);
  }
  const skillScores: SkillScore[] = Array.from(skillScoreMap.entries()).map(([skill, values]) => ({
    skill,
    score: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
  }));

  const strongAreas = skillScores.filter((s) => s.score >= 8).map((s) => s.skill);
  const weakAreas = skillScores.filter((s) => s.score < 6).map((s) => s.skill);

  const snapshot: AnalyticsSnapshot = {
    userId,
    totalAttempts: sessions?.length ?? 0,
    averageScore,
    topicScores,
    skillScores,
    strongAreas,
    weakAreas,
    lastComputedAt: new Date().toISOString(),
  };

  const { error: upsertError } = await db.from("interview_analytics_snapshots").upsert(
    {
      user_id: userId,
      total_attempts: snapshot.totalAttempts,
      average_score: snapshot.averageScore,
      strong_areas: snapshot.strongAreas,
      weak_areas: snapshot.weakAreas,
      last_computed_at: snapshot.lastComputedAt,
    },
    { onConflict: "user_id" }
  );
  if (upsertError) throw new Error(`computeAnalyticsSnapshot: failed to persist snapshot — ${upsertError.message}`);

  return snapshot;
}
