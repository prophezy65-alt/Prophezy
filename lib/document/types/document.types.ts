/**
 * lib/document/types/document.types.ts
 * Shared enums/types used across models, providers, and services.
 */

export type FileFormat =
  | "pdf"
  | "doc"
  | "docx"
  | "txt"
  | "markdown"
  | "csv"
  | "xlsx"
  | "json"
  | "html"
  | "ppt"
  | "pptx"
  | "png"
  | "jpg"
  | "jpeg"
  | "webp"
  | "zip";

export const SUPPORTED_FORMATS: readonly FileFormat[] = [
  "pdf", "doc", "docx", "txt", "markdown", "csv", "xlsx", "json", "html",
  "ppt", "pptx", "png", "jpg", "jpeg", "webp", "zip",
];

/** Future-ready: recognized but not yet routed to a provider (throws a clear NotSupportedYet error). */
export const FUTURE_FORMATS = ["epub", "latex", "odt", "rtf"] as const;
export type FutureFormat = (typeof FUTURE_FORMATS)[number];

export type DocumentTypeLabel =
  | "academic_paper"
  | "resume"
  | "assignment"
  | "lecture_notes"
  | "book"
  | "research_paper"
  | "project_report"
  | "unknown";

export type ProcessingStatus = "queued" | "processing" | "completed" | "failed";

export type ChunkStrategy = "recursive" | "semantic" | "sliding_window";

export type SearchMode =
  | "semantic"
  | "keyword"
  | "hybrid"
  | "full_text"
  | "metadata"
  | "section"
  | "page"
  | "topic";

export type ExportFormat = "json" | "markdown" | "txt" | "html" | "csv" | "docx" | "pdf";

export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
