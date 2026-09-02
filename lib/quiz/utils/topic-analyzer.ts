/**
 * lib/quiz/utils/topic-analyzer.ts
 *
 * Pure aggregation over a graded attempt's responses, grouped by topic.
 * Used by analytics.service.ts to build TopicPerformance[] and by
 * generator.service.ts (indirectly, via analytics) to decide what a
 * follow-up quiz should target.
 */

import type { QuizQuestion, QuizResponse, TopicPerformance } from "../models/quiz.types";

const WEAK_THRESHOLD = 50;
const STRONG_THRESHOLD = 80;

export interface TopicLookup {
  [topicId: string]: { name: string };
}

/**
 * Groups responses by question.topicId and computes accuracy per topic.
 * masteryScore here is attempt-local accuracy; analytics.service.ts blends
 * this with the persisted quiz_topic_mastery EMA for the longer-run score.
 */
export function computeTopicBreakdown(
  questions: QuizQuestion[],
  responses: QuizResponse[],
  topics: TopicLookup
): TopicPerformance[] {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const byTopic = new Map<string, { attempted: number; correct: number }>();

  for (const response of responses) {
    const question = questionById.get(response.questionId);
    if (!question?.topicId) continue;
    if (response.marksAwarded === null) continue; // not yet graded

    const bucket = byTopic.get(question.topicId) ?? { attempted: 0, correct: 0 };
    bucket.attempted += 1;
    if (response.isCorrect) bucket.correct += 1;
    byTopic.set(question.topicId, bucket);
  }

  return [...byTopic.entries()].map(([topicId, { attempted, correct }]) => {
    const accuracyPct = attempted > 0 ? Math.round((correct / attempted) * 10000) / 100 : 0;
    return {
      topicId,
      topicName: topics[topicId]?.name ?? "Unknown topic",
      attempted,
      correct,
      accuracyPct,
      masteryScore: accuracyPct,
    };
  });
}

export function splitWeakStrong(topics: TopicPerformance[]): {
  weak: TopicPerformance[];
  strong: TopicPerformance[];
} {
  return {
    weak: topics.filter((t) => t.masteryScore < WEAK_THRESHOLD).sort((a, b) => a.masteryScore - b.masteryScore),
    strong: topics.filter((t) => t.masteryScore >= STRONG_THRESHOLD).sort((a, b) => b.masteryScore - a.masteryScore),
  };
}

/** Exponential moving average used to update the persisted quiz_topic_mastery.mastery_score. */
export function emaMastery(previousScore: number, previousAttempts: number, newAccuracyPct: number): number {
  // Weight recent performance more when the topic has less history; converge
  // toward a fixed 0.3 smoothing factor as attempts accumulate.
  const alpha = Math.max(0.15, 1 / (previousAttempts + 2));
  const updated = previousAttempts === 0 ? newAccuracyPct : previousScore * (1 - alpha) + newAccuracyPct * alpha;
  return Math.round(updated * 100) / 100;
}

/** Estimated completion time in seconds, based on question type + difficulty + count. */
export function estimateCompletionTimeSec(questions: QuizQuestion[]): number {
  const perQuestionBaseSec: Record<string, number> = {
    mcq: 45,
    true_false: 20,
    fill_in_blank: 30,
    one_word: 20,
    multiple_select: 50,
    match_following: 60,
    ordering: 50,
    short_answer: 120,
    long_answer: 300,
    essay: 600,
    case_study: 480,
    programming: 600,
    debugging: 420,
    sql: 300,
    coding_challenge: 900,
  };
  const difficultyMultiplier: Record<string, number> = { easy: 0.8, medium: 1, hard: 1.3, expert: 1.6 };

  return Math.round(
    questions.reduce((sum, q) => {
      const base = perQuestionBaseSec[q.questionType] ?? 180; // subject-tagged free response types
      return sum + base * (difficultyMultiplier[q.difficulty] ?? 1);
    }, 0)
  );
}

/** Topic weightage: fraction of total marks each topic represents in a quiz. */
export function computeTopicWeightage(questions: QuizQuestion[], topics: TopicLookup): Record<string, number> {
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  if (totalMarks === 0) return {};

  const marksByTopic = new Map<string, number>();
  for (const q of questions) {
    if (!q.topicId) continue;
    marksByTopic.set(q.topicId, (marksByTopic.get(q.topicId) ?? 0) + q.marks);
  }

  const weightage: Record<string, number> = {};
  for (const [topicId, marks] of marksByTopic) {
    weightage[topicId] = Math.round((marks / totalMarks) * 10000) / 100;
  }
  return weightage;
}
