// lib/assignment/validation/schemas.ts
// Dependency-free runtime validation for data crossing the API boundary,
// matching the AI Core Engine's own validator.ts pattern ("Dependency-free
// shape validation + a zod adapter if you add zod later"). Kept
// dependency-free here too so this module doesn't force a zod install just
// to validate a handful of request shapes.

import type { ExportFormat } from "../models/types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

const VALID_EXPORT_FORMATS: ExportFormat[] = ["pdf", "docx", "markdown", "html", "json", "csv"];

export interface UploadBatchRequestBody {
  files: { originalName: string; mimeType: string; sizeBytes: number; storagePath: string }[];
}

export function validateUploadBatchRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) return fail("Request body must be an object");
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.files) || b.files.length === 0) {
    return fail("`files` must be a non-empty array");
  }
  if (b.files.length > 50) {
    return fail("A single batch cannot exceed 50 files");
  }

  const errors: string[] = [];
  b.files.forEach((f, i) => {
    if (typeof f !== "object" || f === null) {
      errors.push(`files[${i}] must be an object`);
      return;
    }
    const file = f as Record<string, unknown>;
    if (typeof file.originalName !== "string" || file.originalName.trim().length === 0) {
      errors.push(`files[${i}].originalName must be a non-empty string`);
    }
    if (typeof file.mimeType !== "string") {
      errors.push(`files[${i}].mimeType must be a string`);
    }
    if (typeof file.sizeBytes !== "number" || file.sizeBytes <= 0) {
      errors.push(`files[${i}].sizeBytes must be a positive number`);
    }
    if (typeof file.storagePath !== "string" || file.storagePath.trim().length === 0) {
      errors.push(`files[${i}].storagePath must be a non-empty string`);
    }
  });

  return errors.length > 0 ? fail(...errors) : ok();
}

export interface GenerateSolutionRequestBody {
  questionId: string;
  depthMode?: "simple" | "standard" | "technical";
}

export function validateGenerateSolutionRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) return fail("Request body must be an object");
  const b = body as Record<string, unknown>;

  const errors: string[] = [];
  if (typeof b.questionId !== "string" || b.questionId.trim().length === 0) {
    errors.push("`questionId` must be a non-empty string");
  }
  if (b.depthMode !== undefined && !["simple", "standard", "technical"].includes(b.depthMode as string)) {
    errors.push('`depthMode` must be one of "simple", "standard", "technical"');
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

export interface ExportRequestBody {
  documentId: string;
  format: string;
  includeSolutions?: boolean;
  includeQuizzes?: boolean;
  includeFlashcards?: boolean;
  includeReferences?: boolean;
}

export function validateExportRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) return fail("Request body must be an object");
  const b = body as Record<string, unknown>;

  const errors: string[] = [];
  if (typeof b.documentId !== "string" || b.documentId.trim().length === 0) {
    errors.push("`documentId` must be a non-empty string");
  }
  if (typeof b.format !== "string" || !VALID_EXPORT_FORMATS.includes(b.format as ExportFormat)) {
    errors.push(`\`format\` must be one of: ${VALID_EXPORT_FORMATS.join(", ")}`);
  }
  for (const flag of ["includeSolutions", "includeQuizzes", "includeFlashcards", "includeReferences"] as const) {
    if (b[flag] !== undefined && typeof b[flag] !== "boolean") {
      errors.push(`\`${flag}\` must be a boolean if provided`);
    }
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

export interface RewriteTextRequestBody {
  text: string;
  register: string;
}

export function validateRewriteTextRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) return fail("Request body must be an object");
  const b = body as Record<string, unknown>;

  const errors: string[] = [];
  if (typeof b.text !== "string" || b.text.trim().length === 0) {
    errors.push("`text` must be a non-empty string");
  }
  if (typeof b.text === "string" && b.text.length > 50000) {
    errors.push("`text` exceeds the 50,000 character limit for a single rewrite request");
  }
  if (typeof b.register !== "string" || !["academic", "professional", "simple", "technical"].includes(b.register)) {
    errors.push('`register` must be one of "academic", "professional", "simple", "technical"');
  }

  return errors.length > 0 ? fail(...errors) : ok();
}
