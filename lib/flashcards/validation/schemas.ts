/**
 * lib/flashcards/validation/schemas.ts
 * Strict Zod schemas for every boundary the Flashcards Engine exposes:
 * generation requests, AI output, review submissions, and export requests.
 */

import { z } from "zod";
import { CARD_TYPES } from "../models/flashcard.model";

export const cardTypeSchema = z.enum(CARD_TYPES as [string, ...string[]]);

export const learningModeSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "exam",
  "competitive_exam",
  "revision",
  "quick_revision",
  "long_term",
]);

export const sourceTypeSchema = z.enum([
  "pdf",
  "docx",
  "txt",
  "markdown",
  "ppt",
  "pptx",
  "image",
  "scanned_pdf",
  "handwritten",
  "url",
  "zip",
  "notes_ai",
  "assignment_ai",
  "syllabus_ai",
  "research_ai",
  "plain_text",
]);

export const reviewRatingSchema = z.enum(["easy", "medium", "hard", "forgot"]);

/** Single AI-generated card, as returned inside the JSON generation response. */
export const draftFlashcardSchema = z.object({
  cardType: cardTypeSchema,
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(4000),
  tags: z.array(z.string().min(1).max(60)).max(10).default([]),
  hint: z.string().max(500).nullable().optional(),
  mnemonic: z.string().max(500).nullable().optional(),
  explanation: z.string().max(2000).nullable().optional(),
  difficulty: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  sourceExcerpt: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

/** Full shape the AI Core Engine must return for a generation call. */
export const generationResponseSchema = z.object({
  deckTitle: z.string().min(1).max(200),
  concepts: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        kind: z.enum(["concept", "topic", "keyword", "formula", "date", "name"]),
        weight: z.number().min(0).max(1).default(1),
      })
    )
    .max(100)
    .default([]),
  cards: z.array(draftFlashcardSchema).min(1).max(200),
});

export type GenerationResponse = z.infer<typeof generationResponseSchema>;
export type DraftFlashcardParsed = z.infer<typeof draftFlashcardSchema>;

/** Client-facing "generate a deck" request. */
export const generateDeckRequestSchema = z.object({
  generationId: z.string().uuid(),
  userId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  sourceType: sourceTypeSchema,
  sourceRef: z.string().max(2000).optional(),
  learningMode: learningModeSchema.default("intermediate"),
  cardTypes: z.array(cardTypeSchema).min(1).max(21).optional(),
  targetCardCount: z.number().int().min(1).max(200).default(30),
  text: z.string().min(1).max(200_000).optional(),
  imageUrls: z.array(z.string().url()).max(50).optional(),
});
export type GenerateDeckRequest = z.infer<typeof generateDeckRequestSchema>;

export const submitReviewRequestSchema = z.object({
  flashcardId: z.string().uuid(),
  userId: z.string().min(1),
  rating: reviewRatingSchema,
  responseTimeMs: z.number().int().min(0).max(600_000).optional(),
});

export const updateFlashcardRequestSchema = z.object({
  id: z.string().uuid(),
  front: z.string().min(1).max(2000).optional(),
  back: z.string().min(1).max(4000).optional(),
  tags: z.array(z.string().min(1).max(60)).max(10).optional(),
  hint: z.string().max(500).nullable().optional(),
  mnemonic: z.string().max(500).nullable().optional(),
  explanation: z.string().max(2000).nullable().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
});

export const searchRequestSchema = z.object({
  deckId: z.string().uuid().optional(),
  userId: z.string().min(1),
  query: z.string().min(1).max(500),
  mode: z.enum(["semantic", "keyword", "topic", "concept", "formula", "tag"]).default("keyword"),
  limit: z.number().int().min(1).max(100).default(20),
});

export const exportRequestSchema = z.object({
  deckId: z.string().uuid(),
  format: z.enum(["pdf", "docx", "markdown", "json", "csv", "txt", "html", "anki"]),
});

/** Convert Zod's parsed camelCase draft into the internal DraftFlashcard shape. */
export function toDraftFlashcard(parsed: DraftFlashcardParsed) {
  return {
    cardType: parsed.cardType as import("../models/flashcard.model").CardType,
    front: parsed.front,
    back: parsed.back,
    tags: parsed.tags,
    hint: parsed.hint ?? null,
    mnemonic: parsed.mnemonic ?? null,
    explanation: parsed.explanation ?? null,
    difficulty: parsed.difficulty as 1 | 2 | 3 | 4 | 5,
    confidence: parsed.confidence,
    sourceExcerpt: parsed.sourceExcerpt ?? null,
    imageUrl: parsed.imageUrl ?? null,
    metadata: parsed.metadata,
  };
}
