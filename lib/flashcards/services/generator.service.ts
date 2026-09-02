/**
 * lib/flashcards/services/generator.service.ts
 *
 * Top-level orchestration for "build me a deck": validate request -> ingest
 * source -> generate cards via AI Core Engine -> dedupe -> persist deck +
 * cards + concepts. This is the single entry point API routes should call.
 */

import { ingestDocument } from "../providers/ingestion.provider";
import { generateCards } from "../generator/card-generator";
import { buildDeck } from "../generator/deck-builder";
import { flashcardsService } from "./flashcards.service";
import { conceptService } from "./concept.service";
import { validationService } from "../validation/validation.service";
import { CARD_TYPES, type CardType } from "../models/flashcard.model";
import type { FlashcardDeck } from "../models/deck.model";
import type { Flashcard } from "../models/flashcard.model";

export interface GenerateDeckParams {
  generationId: string;
  userId: string;
  title?: string;
  sourceType: string;
  sourceRef?: string;
  learningMode?: string;
  cardTypes?: CardType[];
  targetCardCount?: number;
  text?: string;
  imageUrls?: string[];
}

export interface GenerateDeckResult {
  deck: FlashcardDeck;
  cards: Flashcard[];
  droppedDuplicateCount: number;
  flaggedForInjection: boolean;
}

export const generatorService = {
  async generateDeck(rawParams: GenerateDeckParams): Promise<GenerateDeckResult> {
    const params = validationService.validateGenerateDeckRequest(rawParams);

    const ingested = await ingestDocument({
      sourceType: params.sourceType,
      userId: params.userId,
      text: params.text,
      fileRef: params.sourceRef,
    });

    const aiResponse = await generateCards({
      userId: params.userId,
      sourceText: ingested.text,
      learningMode: params.learningMode,
      targetCardCount: params.targetCardCount,
      cardTypes: (params.cardTypes as CardType[] | undefined) ?? (CARD_TYPES as unknown as CardType[]),
    });

    const built = buildDeck({
      aiResponse,
      sourceText: ingested.text,
      learningMode: params.learningMode,
      sourceType: params.sourceType,
      sourceRef: params.sourceRef,
      requestedTitle: params.title,
    });

    const deck = await flashcardsService.createDeck({
      generationId: params.generationId,
      title: built.title,
      learningMode: built.learningMode,
      sourceType: built.sourceType,
      sourceRef: built.sourceRef,
    });

    const cards = await flashcardsService.createCards(deck.id, built.cards);
    await flashcardsService.updateCardCount(deck.id, cards.length);
    await conceptService.saveConcepts(deck.id, built.concepts, cards);

    return {
      deck,
      cards,
      droppedDuplicateCount: built.droppedDuplicateCount,
      flaggedForInjection: ingested.flaggedForInjection,
    };
  },
};
