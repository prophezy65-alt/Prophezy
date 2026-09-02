/**
 * lib/flashcards/services/scheduler.service.ts (co-located in scheduler/ —
 * re-exported from services/index.ts for the naming the spec expects)
 *
 * Builds review queues from a set of flashcards. Pure/computational: takes
 * flashcards already fetched by flashcards.service.ts and returns typed
 * queues; does not touch Supabase itself, so it's trivially testable and
 * reusable from both API routes and background jobs.
 */

import type { Flashcard } from "../models/flashcard.model";
import type {
  FlashcardSchedule,
  ReviewQueue,
  ReviewQueueOptions,
} from "../models/schedule.model";
import { isDue, isLearningCard, isNewCard } from "./sm2";
import { computeLeitnerBox } from "./leitner";

function toSchedule(card: Flashcard, now: Date): FlashcardSchedule {
  return {
    flashcardId: card.id,
    easeFactor: card.easeFactor,
    intervalDays: card.intervalDays,
    repetitions: card.repetitions,
    dueAt: card.dueAt,
    leitnerBox: computeLeitnerBox(card.repetitions, "medium"),
    isDue: isDue(card.dueAt, now),
    isNew: isNewCard(card.repetitions),
    isLearning: isLearningCard(card.repetitions),
  };
}

export const schedulerService = {
  /**
   * Builds today's review queue: overdue + due cards first, then learning
   * cards, then a capped number of brand-new cards to introduce.
   */
  buildReviewQueue(cards: Flashcard[], options: ReviewQueueOptions = {}): ReviewQueue {
    const now = options.now ?? new Date();
    const newCardLimit = options.newCardLimit ?? 20;
    const maxCards = options.maxCards ?? 200;

    const schedules = cards.map((c) => toSchedule(c, now));

    const due = schedules
      .filter((s) => s.isDue && !s.isNew)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    const learning = schedules.filter((s) => s.isLearning && !s.isDue);

    const newCards = schedules.filter((s) => s.isNew).slice(0, newCardLimit);

    const overdueCount = due.filter(
      (s) => now.getTime() - new Date(s.dueAt).getTime() > 24 * 60 * 60 * 1000
    ).length;

    const combined = [...due, ...learning, ...newCards].slice(0, maxCards);
    const combinedIds = new Set(combined.map((s) => s.flashcardId));

    return {
      due: due.filter((s) => combinedIds.has(s.flashcardId)),
      learning: learning.filter((s) => combinedIds.has(s.flashcardId)),
      newCards: newCards.filter((s) => combinedIds.has(s.flashcardId)),
      overdueCount,
    };
  },

  /** Cards due within the next 24h — for a "today" widget. */
  dailyReview(cards: Flashcard[], now: Date = new Date()): FlashcardSchedule[] {
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return cards
      .map((c) => toSchedule(c, now))
      .filter((s) => new Date(s.dueAt) <= cutoff);
  },

  /** Cards due within the next 7 days. */
  weeklyReview(cards: Flashcard[], now: Date = new Date()): FlashcardSchedule[] {
    const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return cards
      .map((c) => toSchedule(c, now))
      .filter((s) => new Date(s.dueAt) <= cutoff);
  },

  /** Cards due within the next 30 days. */
  monthlyReview(cards: Flashcard[], now: Date = new Date()): FlashcardSchedule[] {
    const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return cards
      .map((c) => toSchedule(c, now))
      .filter((s) => new Date(s.dueAt) <= cutoff);
  },

  /**
   * Adaptive scheduling: widen or shrink the new-card intake based on how
   * well the user has been retaining recent reviews, so a struggling user
   * gets fewer new cards and more reinforcement, and a strong user gets a
   * bigger intake.
   */
  adaptiveNewCardLimit(recentRetentionRate: number, baseline = 20): number {
    if (recentRetentionRate >= 0.9) return Math.round(baseline * 1.5);
    if (recentRetentionRate >= 0.75) return baseline;
    if (recentRetentionRate >= 0.5) return Math.round(baseline * 0.6);
    return Math.max(5, Math.round(baseline * 0.3));
  },
};
