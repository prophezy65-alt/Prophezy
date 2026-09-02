/**
 * lib/flashcards/models/analytics.model.ts
 *
 * These are computed views, not tables — `analytics.service.ts` derives them
 * from `flashcard_reviews` + `flashcard_study_sessions` (additive, 0021) on
 * demand. Nothing here is persisted directly.
 */

export interface RetentionStats {
  deckId: string;
  totalReviews: number;
  correctReviews: number; // rating in (easy, medium)
  retentionRate: number; // correctReviews / totalReviews, 0..1
  averageEaseFactor: number;
  matureCardCount: number; // intervalDays >= 21
  learningCardCount: number; // repetitions < 3
}

export interface TopicStrength {
  concept: string;
  kind: string;
  attempts: number;
  retentionRate: number;
}

export interface DeckAnalytics {
  deckId: string;
  cardsCreated: number;
  cardsReviewed: number;
  retention: RetentionStats;
  weakTopics: TopicStrength[];
  strongTopics: TopicStrength[];
  averageAccuracy: number;
  masteryScore: number; // 0..100 composite score
  completionPercent: number; // reviewed-at-least-once / total
}

export interface UserAnalytics {
  userId: string;
  totalCardsReviewed: number;
  learningStreakDays: number;
  timeStudiedMinutes: number;
  overallRetention: number;
  decks: DeckAnalytics[];
}

export interface StudySession {
  id: string;
  deckId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  cardsSeen: number;
  cardsCorrect: number;
}

export interface StudySessionRow {
  id: string;
  deck_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  cards_seen: number;
  cards_correct: number;
}

export function rowToStudySession(row: StudySessionRow): StudySession {
  return {
    id: row.id,
    deckId: row.deck_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    cardsSeen: row.cards_seen,
    cardsCorrect: row.cards_correct,
  };
}
