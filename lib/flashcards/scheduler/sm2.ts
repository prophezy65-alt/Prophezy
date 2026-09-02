/**
 * lib/flashcards/scheduler/sm2.ts
 *
 * Standard SuperMemo-2 algorithm, operating on the native columns already
 * present on `public.flashcards`: ease_factor, interval_days, repetitions,
 * due_at. Pure functions only — no I/O, so this is trivially unit-testable
 * and reused by both review.service.ts and analytics.service.ts.
 */

import type { ReviewRating } from "../models/review.model";
import { RATING_TO_QUALITY } from "../models/schedule.model";
import type { ScheduleUpdateResult } from "../models/schedule.model";
import { computeLeitnerBox } from "./leitner";

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

export interface SM2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

/**
 * Applies one SM-2 review step and returns the new state + due date.
 * `quality` is 0-5 (0 = complete blackout, 5 = perfect recall); ratings map
 * to quality via RATING_TO_QUALITY.
 */
export function applySM2(
  state: SM2State,
  rating: ReviewRating,
  now: Date = new Date()
): ScheduleUpdateResult {
  const quality = RATING_TO_QUALITY[rating];

  let { easeFactor, intervalDays, repetitions } = state;
  easeFactor = easeFactor || DEFAULT_EASE_FACTOR;

  if (quality < 3) {
    // Forgot or hard-failed: reset the learning progress, but never punish
    // ease factor below the floor and never go negative on interval.
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;

    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    easeFactor =
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(easeFactor, MIN_EASE_FACTOR);
  }

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    easeFactor: Number(easeFactor.toFixed(2)),
    intervalDays,
    repetitions,
    dueAt: dueAt.toISOString(),
    leitnerBox: computeLeitnerBox(repetitions, rating),
  };
}

export function isDue(dueAt: string, now: Date = new Date()): boolean {
  return new Date(dueAt).getTime() <= now.getTime();
}

export function isNewCard(repetitions: number): boolean {
  return repetitions === 0;
}

export function isLearningCard(repetitions: number): boolean {
  return repetitions > 0 && repetitions < 3;
}
