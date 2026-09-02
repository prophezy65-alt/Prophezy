// lib/assignment/services/flashcard.service.ts
import { randomUUID } from "crypto";
import type { Flashcard } from "../models/types";
import { flashcardsPrompt } from "../prompts/flashcards";
import { runAssignmentPrompt } from "../providers/ai-engine.provider";

export interface GenerateFlashcardsOptions {
  userId: string;
  maxCards?: number;
}

export async function generateFlashcards(
  sourceText: string,
  options: GenerateFlashcardsOptions
): Promise<Flashcard[]> {
  if (sourceText.trim().length === 0) return [];

  const result = await runAssignmentPrompt(
    flashcardsPrompt,
    { sourceText, maxCards: options.maxCards ?? 12 },
    { userId: options.userId }
  );

  return result.flashcards.map((c) => ({
    id: randomUUID(),
    front: c.front,
    back: c.back,
    topic: c.topic,
  }));
}

/** Generates flashcards from several sources (e.g. every question in a
 * document) and de-duplicates near-identical fronts across the batch, since
 * overlapping topics can otherwise produce repeat cards. */
export async function generateFlashcardsForDocument(
  sourceTexts: string[],
  options: GenerateFlashcardsOptions
): Promise<Flashcard[]> {
  const perSourceCards = await Promise.all(
    sourceTexts.map((text) => generateFlashcards(text, { ...options, maxCards: 6 }))
  );

  const seenFronts = new Set<string>();
  const deduped: Flashcard[] = [];
  for (const card of perSourceCards.flat()) {
    const normalized = card.front.trim().toLowerCase();
    if (seenFronts.has(normalized)) continue;
    seenFronts.add(normalized);
    deduped.push(card);
  }
  return deduped;
}
