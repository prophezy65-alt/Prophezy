/**
 * lib/document/models/analysis.model.ts
 */

import type { DocumentTypeLabel } from "../types/document.types";

export interface DocumentAnalysis {
  documentType: DocumentTypeLabel;
  documentTypeConfidence: number; // 0..1
  language: string;
  languageConfidence: number;
  readingLevel: string; // e.g. "college", "high_school", "graduate"
  fleschKincaidGrade: number;
  complexityScore: number; // 0..100
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  sentimentScore: number; // -1..1
  wordCount: number;
  sentenceCount: number;
  averageSentenceLength: number;
}

export interface SearchResult {
  documentId: string;
  chunkId: string | null;
  pageIndex: number | null;
  sectionId: string | null;
  snippet: string;
  score: number;
  matchType: "semantic" | "keyword" | "hybrid" | "full_text" | "metadata" | "section" | "page" | "topic";
}

export interface AnalyticsRow {
  document_id: string;
  event: string;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
