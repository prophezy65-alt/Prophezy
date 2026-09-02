/**
 * lib/flashcards/services/review.service.ts
 *
 * Applies one review to a flashcard: run SM-2, persist the new schedule on
 * `flashcards`, and append an immutable row to `flashcard_reviews` (0008,
 * unchanged) for analytics/history.
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { AIValidationError } from "@/lib/ai/utils/errors";
import { applySM2 } from "../scheduler/sm2";
import { flashcardsService } from "./flashcards.service";
import { validationService } from "../validation/validation.service";
import { rowToReview, type FlashcardReview, type FlashcardReviewRow, type SubmitReviewInput } from "../models/review.model";

// App exposes hard/easy/medium/forgot; DB flashcard_reviews.rating is again/hard/good/easy.
const RATING_TO_DB: Record<"again" | "hard" | "good" | "easy" | "medium" | "forgot" | "hard" | "easy", "again" | "hard" | "good" | "easy"> = {
  forgot: "again", hard: "hard", medium: "good", easy: "easy",
  again: "again", good: "good",
} as any;

export const reviewService = {
  async submitReview(rawInput: SubmitReviewInput): Promise<{
    review: FlashcardReview;
    newEaseFactor: number;
    newIntervalDays: number;
    newDueAt: string;
  }> {
    const input = validationService.validateSubmitReview(rawInput);

    const card = await flashcardsService.getCard(input.flashcardId);
    if (!card) {
      throw new AIValidationError("Flashcard not found.", { flashcardId: input.flashcardId });
    }

    const intervalBefore = card.intervalDays;

    const outcome = applySM2(
      {
        easeFactor: card.easeFactor,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
      },
      input.rating
    );

    await flashcardsService.updateSchedule(card.id, {
      easeFactor: outcome.easeFactor,
      intervalDays: outcome.intervalDays,
      repetitions: outcome.repetitions,
      dueAt: outcome.dueAt,
    });

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("flashcard_reviews")
      .insert({
        flashcard_id: card.id,
        rating: RATING_TO_DB[input.rating],
        interval_before: intervalBefore,
        interval_after: outcome.intervalDays,
      })
      .select()
      .single<FlashcardReviewRow>();

    if (error || !data) {
      throw new AIValidationError("Failed to log flashcard review.", { cause: error?.message });
    }

    return {
      review: rowToReview(data),
      newEaseFactor: outcome.easeFactor,
      newIntervalDays: outcome.intervalDays,
      newDueAt: outcome.dueAt,
    };
  },

  async getReviewHistory(flashcardId: string): Promise<FlashcardReview[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("flashcard_reviews")
      .select()
      .eq("flashcard_id", flashcardId)
      .order("reviewed_at", { ascending: false });

    if (error) throw new AIValidationError("Failed to fetch review history.", { cause: error.message });
    return (data as FlashcardReviewRow[]).map(rowToReview);
  },

  async getDeckReviewHistory(deckId: string): Promise<FlashcardReview[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("flashcard_reviews")
      .select("*, flashcards!inner(deck_id)")
      .eq("flashcards.deck_id", deckId)
      .order("reviewed_at", { ascending: false });

    if (error) throw new AIValidationError("Failed to fetch deck review history.", { cause: error.message });
    return (data as FlashcardReviewRow[]).map(rowToReview);
  },
};
