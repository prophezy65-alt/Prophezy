/**
 * lib/ai/services/flashcard.service.ts
 */
import { runStructured } from "./_run-structured";
import { FLASHCARDS_PROMPT, type FlashcardsInput, type FlashcardsOutput } from "../prompts/flashcards";

export function generateFlashcards(
  userId: string,
  input: FlashcardsInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<FlashcardsOutput> {
  return runStructured(FLASHCARDS_PROMPT, { userId, input, ...opts });
}
