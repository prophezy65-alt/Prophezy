/**
 * lib/flashcards/services/keyword.service.ts
 *
 * Thin, focused service over `flashcard_concepts` (kind = 'keyword') plus
 * the local extractor — used by search.service.ts's keyword/tag modes and
 * by the UI for "browse by keyword" chips.
 */

import { conceptService } from "./concept.service";
import { extractLocalCandidates } from "../generator/concept-extractor";
import type { Concept } from "../models/concept.model";

export const keywordService = {
  async listKeywordsForDeck(deckId: string): Promise<Concept[]> {
    const concepts = await conceptService.listConceptsForDeck(deckId);
    return concepts.filter((c) => c.kind === "keyword");
  },

  /** Cheap local keyword suggestion for a chunk of text (pre-generation preview). */
  suggestKeywords(text: string, limit = 15): string[] {
    return extractLocalCandidates(text, limit).candidateKeywords;
  },

  /** Ranks decks' keywords by weight for a "top keywords" widget. */
  topKeywords(concepts: Concept[], limit = 10): Concept[] {
    return concepts
      .filter((c) => c.kind === "keyword" || c.kind === "concept")
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  },
};
