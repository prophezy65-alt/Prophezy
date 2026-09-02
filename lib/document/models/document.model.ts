/**
 * lib/document/models/document.model.ts
 * The top-level normalized output every provider ultimately produces and
 * every consuming module (Resume Studio, Research AI, Flashcards AI, ...)
 * receives from `documentService.process(file)`.
 */

import type { DocumentTypeLabel, FileFormat, ProcessingStatus } from "../types/document.types";
import type { Page } from "./page.model";
import type { Section } from "./section.model";
import type { TableBlock, Figure, ImageBlock, CodeBlock, Formula } from "./content-block.model";
import type { DocumentMetadata } from "./metadata.model";
import type { Topic, Keyword } from "./topic.model";
import type { Chunk } from "./chunk.model";
import type { DocumentAnalysis } from "./analysis.model";

export interface ProphezyDocument {
  id: string;
  userId: string;
  ownerModule: string | null; // e.g. "resume-studio", "flashcards", null for standalone uploads
  filename: string;
  format: FileFormat;
  status: ProcessingStatus;

  metadata: DocumentMetadata;
  pages: Page[];
  sections: Section[];

  tables: TableBlock[];
  figures: Figure[];
  images: ImageBlock[];
  codeBlocks: CodeBlock[];
  formulas: Formula[];

  topics: Topic[];
  keywords: Keyword[];
  chunks: Chunk[];

  analysis: DocumentAnalysis | null;
  summary: string | null;

  language: string | null;
  readingTimeMinutes: number | null;

  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  owner_module: string | null;
  filename: string;
  format: string;
  status: string;
  metadata: Record<string, unknown>;
  summary: string | null;
  language: string | null;
  reading_time_minutes: number | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  error_message: string | null;
}

export function rowToDocumentShell(row: DocumentRow): Omit<
  ProphezyDocument,
  "pages" | "sections" | "tables" | "figures" | "images" | "codeBlocks" | "formulas" | "topics" | "keywords" | "chunks" | "analysis" | "metadata"
> & { rawMetadata: Record<string, unknown> } {
  return {
    id: row.id,
    userId: row.user_id,
    ownerModule: row.owner_module,
    filename: row.filename,
    format: row.format as FileFormat,
    status: row.status as ProcessingStatus,
    summary: row.summary,
    language: row.language,
    readingTimeMinutes: row.reading_time_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    processedAt: row.processed_at,
    errorMessage: row.error_message,
    rawMetadata: row.metadata ?? {},
  };
}
