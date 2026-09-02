/**
 * lib/quiz/analytics/analytics.service.ts
 *
 * Post-grading analytics: topic breakdown, weak/strong areas, mastery EMA
 * updates, and revision suggestions. Called by quiz.service.ts right after
 * grading.service.ts#submitAttempt finalizes an attempt.
 */

import { computeTopicBreakdown, splitWeakStrong, emaMastery } from "../utils/topic-analyzer";
import type { QuizAttempt, QuizQuestion, QuizResponse, QuizResult, TopicPerformance, QuizAnalyticsSnapshot } from "../models/quiz.types";
import * as provider from "../providers/supabase-quiz.provider";

export async function buildQuizResult(
  attempt: QuizAttempt,
  responses: QuizResponse[],
  questions: QuizQuestion[]
): Promise<QuizResult> {
  const topicIds = [...new Set(questions.map((q) => q.topicId).filter((id): id is string => id !== null))];
  const topics = await provider.getTopicsByIds(topicIds);
  const topicLookup = Object.fromEntries(topics.map((t) => [t.id, { name: t.name }]));

  const topicBreakdown = computeTopicBreakdown(questions, responses, topicLookup);
  const { weak, strong } = splitWeakStrong(topicBreakdown);

  const revisionSuggestions = buildRevisionSuggestions(weak, questions, responses);

  return {
    attempt,
    responses,
    topicBreakdown,
    weakTopics: weak,
    strongTopics: strong,
    revisionSuggestions,
  };
}

function buildRevisionSuggestions(weak: TopicPerformance[], questions: QuizQuestion[], responses: QuizResponse[]): string[] {
  if (weak.length === 0) {
    return ["Strong performance across all covered topics — try a harder difficulty or a new topic next."];
  }

  const missedByTopic = new Map<string, string[]>();
  const responseByQuestionId = new Map(responses.map((r) => [r.questionId, r]));
  for (const q of questions) {
    if (!q.topicId) continue;
    const response = responseByQuestionId.get(q.id);
    if (response && response.isCorrect === false) {
      const list = missedByTopic.get(q.topicId) ?? [];
      list.push(...q.conceptTags);
      missedByTopic.set(q.topicId, list);
    }
  }

  return weak.slice(0, 5).map((t) => {
    const concepts = [...new Set(missedByTopic.get(t.topicId) ?? [])].slice(0, 3);
    const conceptNote = concepts.length ? ` — focus on: ${concepts.join(", ")}` : "";
    return `Revisit "${t.topicName}" (${t.accuracyPct}% accuracy)${conceptNote}`;
  });
}

/** Updates the persisted per-topic mastery EMA for every topic covered in a graded attempt. Reads each topic's current row first so the EMA is a true rolling average across attempts, not reset every time. */
export async function updateTopicMastery(userId: string, topicBreakdown: TopicPerformance[]): Promise<void> {
  await Promise.all(
    topicBreakdown.map(async (t) => {
      const existing = await provider.getTopicMastery(userId, t.topicId);
      const previousScore = existing?.masteryScore ?? 0;
      const previousAttempts = existing?.attemptsCount ?? 0;
      const newScore = emaMastery(previousScore, previousAttempts, t.accuracyPct);
      await provider.upsertTopicMastery(userId, t.topicId, previousScore, previousAttempts, newScore, t.correct);
    })
  );
}

/** Full analytics snapshot for the analytics page: attempt summary + streak + per-topic mastery. */
export async function getAnalyticsSnapshot(userId: string): Promise<QuizAnalyticsSnapshotWithTopics> {
  const [attempts, streak, topicMastery] = await Promise.all([
    provider.listAttemptsByUser(userId, 200),
    provider.getStreak(userId),
    provider.listTopicMasteryForUser(userId),
  ]);

  const graded = attempts.filter((a) => a.status === "graded" && a.finalScore !== null);
  const summary = summarizeAttempts(
    graded,
    graded.map((a) => a.quizQuestionCount || 1)
  );

  return {
    userId,
    totalAttempts: summary.totalAttempts,
    averageScorePct: summary.averageScorePct,
    completionPct: graded.length ? Math.round((graded.reduce((s, a) => s + a.completionPct, 0) / graded.length) * 100) / 100 : 0,
    averageTimePerQuestionSec: summary.averageTimePerQuestionSec,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    topicMastery: topicMastery.map((t) => ({
      topicId: t.topicId,
      topicName: t.topicName,
      attempted: t.attemptsCount,
      correct: t.correctCount,
      accuracyPct: t.attemptsCount > 0 ? Math.round((t.correctCount / t.attemptsCount) * 10000) / 100 : 0,
      masteryScore: t.masteryScore,
    })),
    recentAttempts: attempts.slice(0, 10),
  };
}

export interface QuizAnalyticsSnapshotWithTopics extends QuizAnalyticsSnapshot {
  recentAttempts: Awaited<ReturnType<typeof provider.listAttemptsByUser>>;
}

export interface QuizAnalyticsSummary {
  totalAttempts: number;
  averageScorePct: number;
  averageTimePerQuestionSec: number;
}

export function summarizeAttempts(attempts: QuizAttempt[], questionCounts: number[]): QuizAnalyticsSummary {
  const graded = attempts.filter((a) => a.status === "graded" && a.finalScore !== null);
  const totalAttempts = graded.length;

  const averageScorePct =
    totalAttempts > 0
      ? round2(
          graded.reduce((sum, a) => sum + (a.maxScore > 0 ? (a.finalScore! / a.maxScore) * 100 : 0), 0) / totalAttempts
        )
      : 0;

  const totalTime = graded.reduce((sum, a) => sum + (a.timeTakenSec ?? 0), 0);
  const totalQuestions = questionCounts.reduce((sum, c) => sum + c, 0);
  const averageTimePerQuestionSec = totalQuestions > 0 ? round2(totalTime / totalQuestions) : 0;

  return { totalAttempts, averageScorePct, averageTimePerQuestionSec };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
