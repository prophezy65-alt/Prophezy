/**
 * lib/document/validation/schemas.ts
 */

import { z } from "zod";
import { SUPPORTED_FORMATS } from "../types/document.types";

export const fileFormatSchema = z.enum(SUPPORTED_FORMATS as [string, ...string[]]);

export const processDocumentRequestSchema = z.object({
  userId: z.string().min(1),
  ownerModule: z.string().max(60).nullable().optional(),
  filename: z.string().min(1).max(300),
  format: fileFormatSchema,
  fileRef: z.string().min(1).max(2000).optional(),
  text: z.string().max(2_000_000).optional(),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive(),
  chunkStrategy: z.enum(["recursive", "semantic", "sliding_window"]).default("recursive"),
  extractTables: z.boolean().default(true),
  extractTopics: z.boolean().default(true),
  runOcr: z.boolean().default(true),
});
export type ProcessDocumentRequest = z.infer<typeof processDocumentRequestSchema>;

export const searchDocumentsRequestSchema = z.object({
  userId: z.string().min(1),
  documentId: z.string().uuid().optional(),
  query: z.string().min(1).max(500),
  mode: z
    .enum(["semantic", "keyword", "hybrid", "full_text", "metadata", "section", "page", "topic"])
    .default("hybrid"),
  limit: z.number().int().min(1).max(100).default(20),
});

export const exportDocumentRequestSchema = z.object({
  documentId: z.string().uuid(),
  format: z.enum(["json", "markdown", "txt", "html", "csv", "docx", "pdf"]),
});

/** Shape the AI Core Engine must return for topic/keyword/summary extraction.
 *
 * `title`/`authors` added — FIX for research papers picking up wrong
 * "authors" (e.g. whoever's Google account exported a PDF, not the paper's
 * real byline). Previously this schema had no title/authors at all;
 * document.service.ts fell back entirely to the PDF file's embedded
 * `/Author` metadata field (see pdf.provider.ts), which reflects whoever
 * exported the file, not who wrote the paper. These two fields are
 * extracted from the document's own VISIBLE TEXT by the same AI call that
 * already reads it for topics/keywords — see extraction.prompts.ts for the
 * explicit "only if genuinely printed as a byline, never invented, empty
 * array if none found" instruction. */
export const smartExtractionResponseSchema = z.object({
  summary: z.string().min(1).max(4000),
  title: z.string().max(300).nullable().default(null),
  authors: z.array(z.string().min(1).max(200)).max(30).default([]),
  topics: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        weight: z.number().min(0).max(1),
        pageIndexes: z.array(z.number().int().min(0)).default([]),
      })
    )
    .max(50)
    .default([]),
  keywords: z
    .array(
      z.object({
        term: z.string().min(1).max(100),
        frequency: z.number().int().min(1).default(1),
        weight: z.number().min(0).max(1),
      })
    )
    .max(100)
    .default([]),
  definitions: z
    .array(
      z.object({
        term: z.string().min(1).max(200),
        definition: z.string().min(1).max(1000),
        pageIndex: z.number().int().min(0).default(0),
      })
    )
    .max(100)
    .default([]),
  documentType: z.enum([
    "academic_paper", "resume", "assignment", "lecture_notes", "book",
    "research_paper", "project_report", "unknown",
  ]),
  documentTypeConfidence: z.number().min(0).max(1),
});
export type SmartExtractionResponse = z.infer<typeof smartExtractionResponseSchema>;
