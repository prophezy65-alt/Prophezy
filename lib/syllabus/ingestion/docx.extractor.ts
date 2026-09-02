/**
 * lib/syllabus/ingestion/docx.extractor.ts
 *
 * DOCX files are always native text (no OCR path needed). Uses
 * mammoth to pull raw text while preserving paragraph breaks, which
 * matters for the extraction prompt to correctly separate units/
 * chapters/practicals that are laid out as separate paragraphs or
 * list items in the source document.
 *
 * Requires: npm install mammoth
 */

import mammoth from 'mammoth';

export interface DocxExtractionResult {
  text: string;
  warnings: string[];
}

export async function extractTextFromDocx(buffer: Buffer): Promise<DocxExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value.trim(),
    warnings: result.messages.map((m) => m.message),
  };
}
