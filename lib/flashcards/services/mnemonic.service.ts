/**
 * lib/flashcards/services/mnemonic.service.ts
 */

import { runStructured } from "@/lib/ai/services/_run-structured";
import { mnemonicGenerationPrompt } from "../prompts/flashcards.prompts";
import { flashcardsService } from "./flashcards.service";
import { AIValidationError } from "@/lib/ai/utils/errors";

export interface GeneratedMnemonic {
  mnemonic: string;
  memoryTrick: string;
  analogy: string;
}

export const mnemonicService = {
  async generateAndSaveMnemonic(cardId: string, userId: string): Promise<GeneratedMnemonic> {
    const card = await flashcardsService.getCard(cardId);
    if (!card) throw new AIValidationError("Flashcard not found.", { cardId });

    const result = await runStructured(mnemonicGenerationPrompt, {
      userId,
      input: { front: card.front, back: card.back },
    });

    await flashcardsService.updateCard({ id: cardId, mnemonic: result.mnemonic });

    return result;
  },
};
