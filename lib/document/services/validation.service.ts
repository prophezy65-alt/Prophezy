/**
 * lib/document/services/validation.service.ts
 */

import { z } from "zod";
import { FileValidationError } from "../errors/document-errors";
import {
  processDocumentRequestSchema,
  searchDocumentsRequestSchema,
  exportDocumentRequestSchema,
  smartExtractionResponseSchema,
} from "../validation/schemas";

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown, label: string): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new FileValidationError(`Invalid ${label}.`, {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}

export const validationService = {
  validateProcessRequest: (input: unknown) =>
    parseOrThrow(processDocumentRequestSchema, input, "document processing request"),
  validateSearchRequest: (input: unknown) =>
    parseOrThrow(searchDocumentsRequestSchema, input, "document search request"),
  validateExportRequest: (input: unknown) =>
    parseOrThrow(exportDocumentRequestSchema, input, "document export request"),
  validateSmartExtractionResponse: (input: unknown) =>
    parseOrThrow(smartExtractionResponseSchema, input, "AI smart-extraction response"),
};
