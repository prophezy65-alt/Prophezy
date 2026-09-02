/**
 * lib/flashcards/services/validation.service.ts (re-exported from validation/
 * for discoverability — see index.ts)
 *
 * Thin orchestration layer over the Zod schemas: validate-or-throw helpers
 * used by every route/service so error shapes stay consistent.
 */

import { z } from "zod";
import { AIValidationError } from "@/lib/ai/utils/errors";
import {
  generateDeckRequestSchema,
  generationResponseSchema,
  submitReviewRequestSchema,
  updateFlashcardRequestSchema,
  searchRequestSchema,
  exportRequestSchema,
} from "./schemas";

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown, label: string): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AIValidationError(`Invalid ${label}.`, {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}

export const validationService = {
  validateGenerateDeckRequest: (input: unknown) =>
    parseOrThrow(generateDeckRequestSchema, input, "flashcard generation request"),

  validateGenerationResponse: (input: unknown) =>
    parseOrThrow(generationResponseSchema, input, "AI generation response"),

  validateSubmitReview: (input: unknown) =>
    parseOrThrow(submitReviewRequestSchema, input, "review submission"),

  validateUpdateFlashcard: (input: unknown) =>
    parseOrThrow(updateFlashcardRequestSchema, input, "flashcard update"),

  validateSearchRequest: (input: unknown) =>
    parseOrThrow(searchRequestSchema, input, "search request"),

  validateExportRequest: (input: unknown) =>
    parseOrThrow(exportRequestSchema, input, "export request"),
};
