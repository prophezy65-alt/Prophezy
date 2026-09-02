/**
 * lib/flashcards/generator/deck-builder.ts
 *
 * Assembles the final "ready to persist" package: dedup'd draft cards +
 * merged concepts + deck metadata. `generator.service.ts` is the only
 * caller — this stays a pure function so it's easy to unit test without
 * mocking Supabase or the AI Core Engine.
 */

import { dedupeDraftCards } from "./duplicate-detector";
import { extractLocalCandidates, mergeConcepts, type MergedConcept } from "./concept-extractor";
import { toDraftFlashcard, type GenerationResponse } from "../validation/schemas";
import type { DraftFlashcard } from "../models/flashcard.model";
import type { LearningMode, SourceType } from "../models/deck.model";

export interface BuildDeckInput {
  aiResponse: GenerationResponse;
  sourceText: string;
  learningMode: LearningMode;
  sourceType: SourceType;
  sourceRef?: string;
  requestedTitle?: string;
}

export interface BuiltDeck {
  title: string;
  learningMode: LearningMode;
  sourceType: SourceType;
  sourceRef: string | null;
  cards: DraftFlashcard[];
  concepts: MergedConcept[];
  droppedDuplicateCount: number;
}

export function buildDeck(input: BuildDeckInput): BuiltDeck {
  const drafts = input.aiResponse.cards.map(toDraftFlashcard);
  const deduped = dedupeDraftCards(drafts);

  const local = extractLocalCandidates(input.sourceText);
  const concepts = mergeConcepts(input.aiResponse.concepts, local);

  return {
    title: input.requestedTitle?.trim() || input.aiResponse.deckTitle,
    learningMode: input.learningMode,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef ?? null,
    cards: deduped,
    concepts,
    droppedDuplicateCount: drafts.length - deduped.length,
  };
}
