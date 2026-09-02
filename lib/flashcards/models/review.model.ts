/**
 * lib/flashcards/models/review.model.ts
 * Maps onto `public.flashcard_reviews` (0008, unchanged).
 */

export type ReviewRating = "easy" | "medium" | "hard" | "forgot";

export interface FlashcardReview {
  id: string;
  flashcardId: string;
  rating: ReviewRating;
  intervalBefore: number;
  intervalAfter: number;
  reviewedAt: string;
}

export interface FlashcardReviewRow {
  id: string;
  flashcard_id: string;
  rating: string;
  interval_before: number;
  interval_after: number;
  reviewed_at: string;
}

export function rowToReview(row: FlashcardReviewRow): FlashcardReview {
  return {
    id: row.id,
    flashcardId: row.flashcard_id,
    rating: row.rating as ReviewRating,
    intervalBefore: row.interval_before,
    intervalAfter: row.interval_after,
    reviewedAt: row.reviewed_at,
  };
}

export interface SubmitReviewInput {
  flashcardId: string;
  userId: string;
  rating: ReviewRating;
  /** ms the user spent looking at the card before answering, for analytics.service.ts */
  responseTimeMs?: number;
}
