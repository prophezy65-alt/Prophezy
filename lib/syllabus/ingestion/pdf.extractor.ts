/**
 * lib/syllabus/ingestion/pdf.extractor.ts
 *
 * Extracts raw text directly from a PDF's text layer. Many syllabus
 * PDFs (university-issued, LaTeX/Word-exported) have a real text
 * layer and don't need OCR at all — this is tried first since it's
 * far cheaper and more accurate than OCR when available.
 *
 * Requires: npm install pdf-parse@1.1.1
 *
 * PINNED to v1: pdf-parse v2 shipped a completely different,
 * class-based API (`new PDFParse(...).getText()`) that breaks the
 * simple `pdfParse(buffer) -> { text, numpages }` call below. If you
 * later upgrade to v2, this file is the only place that needs to
 * change.
 */

import { PDFParse } from 'pdf-parse';

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  /** Rough signal for "this is a scanned/image-only PDF" — very low
   *  characters-per-page means the text layer is empty or noise. */
  looksLikeScannedDocument: boolean;
}

const SCANNED_DOCUMENT_CHARS_PER_PAGE_THRESHOLD = 40;

export async function extractTextFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  let text: string;
  let pageCount: number;
  try {
    const parsed = await parser.getText();
    text = parsed.text.trim();
    pageCount = parsed.pages.length || 1;
  } finally {
    await parser.destroy();
  }
  const charsPerPage = text.length / Math.max(pageCount, 1);

  return {
    text,
    pageCount,
    looksLikeScannedDocument: charsPerPage < SCANNED_DOCUMENT_CHARS_PER_PAGE_THRESHOLD,
  };
}
