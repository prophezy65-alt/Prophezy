/**
 * lib/quiz/services/adaptive.service.ts
 *
 * Question-by-question difficulty adjustment within a single adaptive quiz
 * attempt. Uses a simple, explainable staircase model (not a full IRT
 * model) — deliberately simple so behavior is predictable and debuggable:
 * two correct answers in a row at the current difficulty step up; one wrong
 * answer steps down immediately (wrong answers should reduce difficulty
 * faster than right answers increase it, matching how adaptive exams like
 * the GRE behave).
 */

import { difficultyAt, difficultyIndex } from "./difficulty.service";
import type { QuizDifficulty } from "../models/quiz.types";

export interface AdaptiveState {
  currentDifficulty: QuizDifficulty;
  consecutiveCorrect: number;
}

export function initialAdaptiveState(startingDifficulty: QuizDifficulty): AdaptiveState {
  return { currentDifficulty: startingDifficulty, consecutiveCorrect: 0 };
}

const STEP_UP_STREAK = 2;

/** Call after each graded response to get the difficulty for the NEXT question in the run. */
export function nextAdaptiveState(state: AdaptiveState, wasCorrect: boolean): AdaptiveState {
  if (!wasCorrect) {
    return {
      currentDifficulty: difficultyAt(difficultyIndex(state.currentDifficulty) - 1),
      consecutiveCorrect: 0,
    };
  }

  const consecutiveCorrect = state.consecutiveCorrect + 1;
  if (consecutiveCorrect >= STEP_UP_STREAK) {
    return {
      currentDifficulty: difficultyAt(difficultyIndex(state.currentDifficulty) + 1),
      consecutiveCorrect: 0,
    };
  }

  return { currentDifficulty: state.currentDifficulty, consecutiveCorrect };
}

/**
 * Picks the next question from a pool for an adaptive run: prefers an
 * unused question matching the target difficulty exactly, falls back to the
 * closest available difficulty if the pool is exhausted at that level.
 */
export function pickNextQuestion<T extends { id: string; difficulty: QuizDifficulty }>(
  pool: T[],
  usedIds: Set<string>,
  targetDifficulty: QuizDifficulty
): T | null {
  const unused = pool.filter((q) => !usedIds.has(q.id));
  if (unused.length === 0) return null;

  const exact = unused.find((q) => q.difficulty === targetDifficulty);
  if (exact) return exact;

  const targetIndex = difficultyIndex(targetDifficulty);
  const sorted = [...unused].sort(
    (a, b) => Math.abs(difficultyIndex(a.difficulty) - targetIndex) - Math.abs(difficultyIndex(b.difficulty) - targetIndex)
  );
  return sorted[0] ?? null;
}
