/**
 * lib/flashcards/models/schedule.model.ts
 *
 * `FlashcardSchedule` is NOT a separate table — SM-2 state already lives on
 * `public.flashcards` (ease_factor / interval_days / repetitions / due_at).
 * This model is the typed view scheduler.service.ts computes and returns to
 * callers, plus the Leitner box derived from repetitions/rating history.
 */

import type { ReviewRating } from "./review.model";

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export interface FlashcardSchedule {
  flashcardId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
  leitnerBox: LeitnerBox;
  isDue: boolean;
  isNew: boolean;
  isLearning: boolean;
}

export interface ScheduleUpdateResult {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
  leitnerBox: LeitnerBox;
}

export interface ReviewQueue {
  due: FlashcardSchedule[];
  learning: FlashcardSchedule[];
  newCards: FlashcardSchedule[];
  overdueCount: number;
}

export interface ReviewQueueOptions {
  /** Cap on brand-new (repetitions === 0) cards introduced per queue pull. */
  newCardLimit?: number;
  /** Cap on total cards returned. */
  maxCards?: number;
  now?: Date;
}

export const RATING_TO_QUALITY: Record<ReviewRating, number> = {
  forgot: 0,
  hard: 3,
  medium: 4,
  easy: 5,
};
