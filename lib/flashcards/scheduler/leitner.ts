/**
 * lib/flashcards/scheduler/leitner.ts
 *
 * Classic 5-box Leitner system, run alongside SM-2 as a simpler mental
 * model callers can display in the UI ("Box 3 of 5") without exposing raw
 * ease factors. Box is *derived* from repetitions + last rating rather than
 * stored separately, so it never drifts out of sync with SM-2 state.
 */

import type { ReviewRating } from "../models/review.model";
import type { LeitnerBox } from "../models/schedule.model";

const BOX_INTERVAL_DAYS: Record<LeitnerBox, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 14,
};

export function computeLeitnerBox(repetitions: number, lastRating: ReviewRating): LeitnerBox {
  if (lastRating === "forgot") return 1;

  // Repetitions already reflects SM-2's reset-on-fail behavior, so box
  // simply tracks how many consecutive successful reviews have happened,
  // capped at 5.
  const box = Math.min(5, Math.max(1, repetitions)) as LeitnerBox;

  // "hard" caps advancement at box 3 even with many repetitions, since a
  // hard-won recall shouldn't get the same long gap as an easy one.
  if (lastRating === "hard" && box > 3) return 3;

  return box;
}

export function leitnerIntervalDays(box: LeitnerBox): number {
  return BOX_INTERVAL_DAYS[box];
}

export function nextBoxOnSuccess(box: LeitnerBox): LeitnerBox {
  return Math.min(5, box + 1) as LeitnerBox;
}

export function resetBoxOnFailure(): LeitnerBox {
  return 1;
}
