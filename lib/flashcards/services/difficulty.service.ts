/**
 * lib/flashcards/services/difficulty.service.ts
 *
 * The AI assigns an initial difficulty (1-5) at generation time. This
 * service recalibrates it from real review performance once enough data
 * exists, and classifies learning-mode-appropriate difficulty bands.
 */

import { flashcardsService } from "./flashcards.service";
import { reviewService } from "./review.service";
import { DIFFICULTY_LABELS, type Difficulty } from "../models/concept.model";
import type { LearningMode } from "../models/deck.model";

const MIN_REVIEWS_FOR_RECALIBRATION = 3;

export const difficultyService = {
  classify(level: 1 | 2 | 3 | 4 | 5, reasoning: string): Difficulty {
    return { level, reasoning, label: DIFFICULTY_LABELS[level] };
  },

  /**
   * Recomputes a card's difficulty from its own review history: cards that
   * get "forgot"/"hard" often are harder than the AI initially estimated,
   * regardless of what the model guessed from the raw text.
   */
  async recalibrate(cardId: string): Promise<Difficulty | null> {
    const history = await reviewService.getReviewHistory(cardId);
    if (history.length < MIN_REVIEWS_FOR_RECALIBRATION) return null;

    const weights: Record<string, number> = { forgot: 1, hard: 0.6, medium: 0.2, easy: 0 };
    const avgDifficultySignal =
      history.reduce((sum, r) => sum + (weights[r.rating] ?? 0.2), 0) / history.length;

    // 0 (always easy) -> level 1, 1 (always forgot) -> level 5
    const level = Math.min(5, Math.max(1, Math.round(1 + avgDifficultySignal * 4))) as Difficulty["level"];

    const reasoning = `Recalibrated from ${history.length} reviews (avg difficulty signal ${avgDifficultySignal.toFixed(2)}).`;

    await flashcardsService.updateCard({ id: cardId, difficulty: level });

    return this.classify(level, reasoning);
  },

  /** Suggests which difficulty band a learning mode should surface first. */
  recommendedBandFor(mode: LearningMode): [number, number] {
    switch (mode) {
      case "beginner":
        return [1, 2];
      case "intermediate":
        return [2, 4];
      case "advanced":
      case "competitive_exam":
        return [3, 5];
      case "exam":
        return [2, 5];
      case "revision":
      case "quick_revision":
        return [1, 3];
      case "long_term":
        return [1, 5];
      default:
        return [1, 5];
    }
  },
};
