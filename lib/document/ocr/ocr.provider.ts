/**
 * lib/document/ocr/ocr.provider.ts
 *
 * Same integration point as `lib/flashcards/providers/ocr.provider.ts` —
 * both should ultimately call the SAME underlying `lib/ai/services/ocr.service.ts`
 * (per README: "Two-stage: Tesseract.js extracts raw text, cleanup pass
 * structures it. Falls back to Gemini vision when Tesseract confidence is
 * low."), so there's exactly one OCR implementation in the whole codebase,
 * not two. If you've already wired the Flashcards one, import from there
 * instead of duplicating this file.
 *
 * ACTION NEEDED: same as flashcards — swap the throw below for the real
 * import once you share `ocr.service.ts`.
 */

import { OcrError } from "../errors/document-errors";

export interface OcrRequest {
  imageBuffer: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
  userId: string;
  language?: string; // ISO 639-1, for multi-language OCR
}

export interface OcrResponse {
  text: string;
  confidence: number; // 0..1
  usedFallback: boolean;
  detectedLanguage: string | null;
}

export async function runOcr(_request: OcrRequest): Promise<OcrResponse> {
  throw new OcrError(
    "ocr.provider.ts: wire this up to the real lib/ai/services/ocr.service.ts export. " +
      "Not implemented as a placeholder to avoid silently returning fake OCR text."
  );
}

/**
 * Table-specific OCR pass — some OCR engines need a different mode/prompt
 * to preserve row/column structure instead of flattening a table into a
 * single text blob. Falls through to the same underlying service with a
 * table-aware hint once wired.
 */
export async function runTableOcr(_request: OcrRequest): Promise<{ rows: string[][]; confidence: number }> {
  throw new OcrError(
    "ocr.provider.ts: runTableOcr needs the real OCR service's table-mode export — not wired yet."
  );
}

/**
 * Formula OCR — LaTeX-aware pass for equations. Many OCR stacks route this
 * to a dedicated model (e.g. Gemini vision with a math-specific prompt)
 * rather than Tesseract, since Tesseract handles prose far better than
 * symbolic math.
 */
export async function runFormulaOcr(_request: OcrRequest): Promise<{ latex: string; confidence: number }> {
  throw new OcrError(
    "ocr.provider.ts: runFormulaOcr needs a math-aware OCR path (typically Gemini vision) — not wired yet."
  );
}
