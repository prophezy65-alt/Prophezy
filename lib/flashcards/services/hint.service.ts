/**
 * lib/flashcards/services/hint.service.ts
 */

import { runStructured } from "@/lib/ai/services/_run-structured";
import { hintGenerationPrompt } from "../prompts/flashcards.prompts";
import { flashcardsService } from "./flashcards.service";
import { AIValidationError } from "@/lib/ai/utils/errors";
import type { LearningMode } from "../models/deck.model";

export const hintService = {
  async generateAndSaveHint(cardId: string, userId: string, learningMode: LearningMode): Promise<string> {
    const card = await flashcardsService.getCard(cardId);
    if (!card) throw new AIValidationError("Flashcard not found.", { cardId });

    const result = await runStructured(hintGenerationPrompt, {
      userId,
      input: { front: card.front, back: card.back, learningMode },
    });

    await flashcardsService.updateCard({ id: cardId, hint: result.hint });
    return result.hint;
  },
};
