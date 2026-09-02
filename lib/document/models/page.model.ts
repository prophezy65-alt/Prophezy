/**
 * lib/document/models/page.model.ts
 */

export interface Page {
  index: number; // 0-based
  pageNumber: number; // 1-based, as printed
  text: string;
  wordCount: number;
  hasImages: boolean;
  hasTables: boolean;
  ocrApplied: boolean;
  ocrConfidence: number | null;
}

export interface PageRow {
  id: string;
  document_id: string;
  page_index: number;
  page_number: number;
  text: string;
  word_count: number;
  has_images: boolean;
  has_tables: boolean;
  ocr_applied: boolean;
  ocr_confidence: number | null;
}

export function rowToPage(row: PageRow): Page {
  return {
    index: row.page_index,
    pageNumber: row.page_number,
    text: row.text,
    wordCount: row.word_count,
    hasImages: row.has_images,
    hasTables: row.has_tables,
    ocrApplied: row.ocr_applied,
    ocrConfidence: row.ocr_confidence,
  };
}
