/**
 * lib/flashcards/services/analytics.service.ts
 *
 * Everything here is COMPUTED at read time from `flashcard_reviews` (0008)
 * and `flashcard_study_sessions` (additive, 0021) — there is no separate
 * analytics table to keep in sync, so numbers can never drift from the
 * source of truth.
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { AIValidationError } from "@/lib/ai/utils/errors";
import { flashcardsService } from "./flashcards.service";
import type { FlashcardReviewRow } from "../models/review.model";
import { rowToStudySession, type StudySessionRow } from "../models/analytics.model";
import type {
  DeckAnalytics,
  RetentionStats,
  TopicStrength,
  UserAnalytics,
} from "../models/analytics.model";
import { conceptService } from "./concept.service";

const CORRECT_RATINGS = new Set(["easy", "medium"]);
const MATURE_INTERVAL_DAYS = 21;

function computeRetention(deckId: string, reviews: FlashcardReviewRow[], easeFactors: number[], intervals: number[], repetitions: number[]): RetentionStats {
  const totalReviews = reviews.length;
  const correctReviews = reviews.filter((r) => CORRECT_RATINGS.has(r.rating)).length;
  const averageEaseFactor =
    easeFactors.length > 0 ? easeFactors.reduce((a, b) => a + b, 0) / easeFactors.length : 2.5;
  const matureCardCount = intervals.filter((i) => i >= MATURE_INTERVAL_DAYS).length;
  const learningCardCount = repetitions.filter((r) => r < 3).length;

  return {
    deckId,
    totalReviews,
    correctReviews,
    retentionRate: totalReviews > 0 ? correctReviews / totalReviews : 0,
    averageEaseFactor: Number(averageEaseFactor.toFixed(2)),
    matureCardCount,
    learningCardCount,
  };
}

function computeMasteryScore(retention: RetentionStats, completionPercent: number): number {
  // Weighted composite: retention matters most, then how mature the deck's
  // cards are (long intervals = well-learned), then simple completion.
  const maturityRatio =
    retention.totalReviews > 0 ? retention.matureCardCount / Math.max(1, retention.totalReviews) : 0;
  const score = retention.retentionRate * 60 + maturityRatio * 25 + (completionPercent / 100) * 15;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export const analyticsService = {
  async getDeckAnalytics(deckId: string): Promise<DeckAnalytics> {
    const supabase = await getSupabaseServerClient();
    const cards = await flashcardsService.listCardsForDeck(deckId);

    const { data: reviewRows, error } = await supabase
      .from("flashcard_reviews")
      .select("*, flashcards!inner(deck_id)")
      .eq("flashcards.deck_id", deckId);

    if (error) throw new AIValidationError("Failed to compute deck analytics.", { cause: error.message });
    const reviews = (reviewRows as FlashcardReviewRow[]) ?? [];

    const retention = computeRetention(
      deckId,
      reviews,
      cards.map((c) => c.easeFactor),
      cards.map((c) => c.intervalDays),
      cards.map((c) => c.repetitions)
    );

    const reviewedCardIds = new Set(reviews.map((r) => r.flashcard_id));
    const completionPercent = cards.length > 0 ? (reviewedCardIds.size / cards.length) * 100 : 0;

    const { weakTopics, strongTopics } = await conceptService.getTopicStrength(deckId);

    return {
      deckId,
      cardsCreated: cards.length,
      cardsReviewed: reviewedCardIds.size,
      retention,
      weakTopics,
      strongTopics,
      averageAccuracy: Number((retention.retentionRate * 100).toFixed(1)),
      masteryScore: computeMasteryScore(retention, completionPercent),
      completionPercent: Number(completionPercent.toFixed(1)),
    };
  },

  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const decks = await flashcardsService.listDecksForUser(userId);
    const deckAnalytics = await Promise.all(decks.map((d) => this.getDeckAnalytics(d.id)));

    const totalCardsReviewed = deckAnalytics.reduce((sum, d) => sum + d.cardsReviewed, 0);
    const totalReviews = deckAnalytics.reduce((sum, d) => sum + d.retention.totalReviews, 0);
    const totalCorrect = deckAnalytics.reduce((sum, d) => sum + d.retention.correctReviews, 0);

    const supabase = await getSupabaseServerClient();
    const { data: sessionRows, error } = await supabase
      .from("flashcard_study_sessions")
      .select()
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (error) throw new AIValidationError("Failed to fetch study sessions.", { cause: error.message });
    const sessions = ((sessionRows as StudySessionRow[]) ?? []).map(rowToStudySession);

    const timeStudiedMinutes = sessions.reduce((sum, s) => {
      if (!s.endedAt) return sum;
      const ms = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
      return sum + Math.max(0, ms / 60000);
    }, 0);

    return {
      userId,
      totalCardsReviewed,
      learningStreakDays: computeStreakDays(sessions.map((s) => s.startedAt)),
      timeStudiedMinutes: Math.round(timeStudiedMinutes),
      overallRetention: totalReviews > 0 ? Number((totalCorrect / totalReviews).toFixed(3)) : 0,
      decks: deckAnalytics,
    };
  },

  async startSession(deckId: string, userId: string): Promise<{ sessionId: string }> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("flashcard_study_sessions")
      .insert({ deck_id: deckId, user_id: userId })
      .select("id")
      .single<{ id: string }>();

    if (error || !data) throw new AIValidationError("Failed to start study session.", { cause: error?.message });
    return { sessionId: data.id };
  },

  async endSession(sessionId: string, cardsSeen: number, cardsCorrect: number): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("flashcard_study_sessions")
      .update({ ended_at: new Date().toISOString(), cards_seen: cardsSeen, cards_correct: cardsCorrect })
      .eq("id", sessionId);

    if (error) throw new AIValidationError("Failed to end study session.", { cause: error.message });
  },
};

/** Consecutive-day streak, walking backward from the most recent session. */
function computeStreakDays(sessionStartTimes: string[]): number {
  if (sessionStartTimes.length === 0) return 0;

  const days = Array.from(
    new Set(sessionStartTimes.map((t) => new Date(t).toISOString().slice(0, 10)))
  )
    .sort()
    .reverse();

  let streak = 0;
  let cursor = new Date();

  for (const day of days) {
    const cursorDay = cursor.toISOString().slice(0, 10);
    if (day === cursorDay) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
