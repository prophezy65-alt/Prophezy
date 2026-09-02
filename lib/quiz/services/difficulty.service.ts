/**
 * lib/quiz/services/difficulty.service.ts
 *
 * Non-adaptive difficulty logic: picking a starting difficulty for a new
 * quiz based on a user's history, and classifying a completed attempt's
 * performance against its target difficulty. Adaptive (mid-quiz, question-
 * by-question) difficulty adjustment lives in adaptive.service.ts.
 */

import type { QuizAttempt, QuizDifficulty } from "../models/quiz.types";

const DIFFICULTY_ORDER: QuizDifficulty[] = ["easy", "medium", "hard", "expert"];

export function difficultyIndex(d: QuizDifficulty): number {
  return DIFFICULTY_ORDER.indexOf(d);
}

export function difficultyAt(index: number): QuizDifficulty {
  const clamped = Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, index));
  return DIFFICULTY_ORDER[clamped]!;
}

/**
 * Suggests a starting difficulty for a user's next quiz on a topic, based on
 * their recent attempts there. No history -> 'medium' default.
 */
export function suggestStartingDifficulty(recentAttempts: QuizAttempt[]): QuizDifficulty {
  const graded = recentAttempts.filter((a) => a.status === "graded" && a.accuracyPct !== null);
  if (graded.length === 0) return "medium";

  const avgAccuracy = graded.reduce((sum, a) => sum + (a.accuracyPct ?? 0), 0) / graded.length;
  const currentDifficulties = graded.map((a) => a.nextDifficulty ?? "medium").map(difficultyIndex);
  const avgDifficultyIndex = currentDifficulties.reduce((a, b) => a + b, 0) / currentDifficulties.length;

  if (avgAccuracy >= 85) return difficultyAt(Math.round(avgDifficultyIndex) + 1);
  if (avgAccuracy < 50) return difficultyAt(Math.round(avgDifficultyIndex) - 1);
  return difficultyAt(Math.round(avgDifficultyIndex));
}

export type PerformanceBand = "struggling" | "on_track" | "excelling";

export function classifyPerformance(accuracyPct: number): PerformanceBand {
  if (accuracyPct < 50) return "struggling";
  if (accuracyPct >= 85) return "excelling";
  return "on_track";
}
