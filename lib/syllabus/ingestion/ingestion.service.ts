/**
 * lib/syllabus/ingestion/ingestion.service.ts
 *
 * Single entry point: takes a SyllabusIngestionInput (pdf/docx/image/
 * text) and returns IngestedSyllabusText — plain text, ready for the
 * extraction prompt. Dispatches by format:
 *
 *   pdf   -> extractTextFromPdf(); if it looks scanned, falls back
 *            to the EXISTING OCR service (do not duplicate OCR).
 *   docx  -> extractTextFromDocx()
 *   image -> ALWAYS the existing OCR service
 *   text  -> normalizePlainText()
 *
 * NOTE ON INTEGRATION: this reuses your existing
 * `lib/ai/services/ocr.service.ts` (per your own README: "Two-stage:
 * Tesseract.js extracts raw text, then a Gemini cleanup pass
 * structures it. Falls back to Gemini vision when Tesseract
 * confidence is low.") rather than re-implementing OCR here — that
 * was an explicit instruction. The exact export name/signature is
 * assumed below as `runOcr(buffer, mimeType)`; if your real export
 * differs, this file is the only place that needs updating.
 */

import { ocrImage } from '@/lib/ai/services/ocr.service';
import { extractTextFromPdf } from './pdf.extractor';
import { extractTextFromDocx } from './docx.extractor';
import { normalizePlainText } from './text.extractor';
import type {
  IngestedSyllabusText,
  SyllabusIngestionInput,
} from '../models/syllabus.types';
import { ProviderRequestError } from '../utils/syllabus.errors';
import { syllabusLogger } from '../utils/syllabus.logger';

export async function ingestSyllabus(
  userId: string,
  input: SyllabusIngestionInput,
): Promise<IngestedSyllabusText> {
  const warnings: string[] = [];

  switch (input.format) {
    case 'text': {
      const text = normalizePlainText(input.content as string);
      return { rawText: text, format: 'text', usedOcr: false, warnings };
    }

    case 'docx': {
      const buffer = input.content as Buffer;
      const { text, warnings: docxWarnings } = await extractTextFromDocx(buffer);
      if (!text) {
        throw new ProviderRequestError(
          'docx-extractor',
          'No extractable text found in DOCX file',
        );
      }
      return {
        rawText: text,
        format: 'docx',
        usedOcr: false,
        warnings: docxWarnings,
      };
    }

    case 'pdf': {
      const buffer = input.content as Buffer;
      const pdfResult = await extractTextFromPdf(buffer);

      if (!pdfResult.looksLikeScannedDocument && pdfResult.text.length > 0) {
        return {
          rawText: pdfResult.text,
          format: 'pdf',
          usedOcr: false,
          pageCount: pdfResult.pageCount,
          warnings,
        };
      }

      syllabusLogger.info('ingestion.pdf.fallback-to-ocr', {
        pageCount: pdfResult.pageCount,
        extractedChars: pdfResult.text.length,
      });
      warnings.push('PDF text layer was empty or too sparse — used OCR fallback.');

      const ocrResult = await ocrImage(userId, buffer);
      return {
        rawText: ocrResult.cleanedText,
        format: 'pdf',
        usedOcr: true,
        ocrConfidence: ocrResult.rawConfidence,
        pageCount: pdfResult.pageCount,
        warnings,
      };
    }

    case 'image': {
      const buffer = input.content as Buffer;
      const ocrResult = await ocrImage(userId, buffer);
      return {
        rawText: ocrResult.cleanedText,
        format: 'image',
        usedOcr: true,
        ocrConfidence: ocrResult.rawConfidence,
        warnings,
      };
    }

    default: {
      const exhaustiveCheck: never = input.format;
      throw new ProviderRequestError(
        'ingestion-service',
        `Unsupported syllabus format: ${exhaustiveCheck}`,
      );
    }
  }
}
