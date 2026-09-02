/**
 * parser.service.ts
 * Orchestrates resume import: raw text extraction per file type, then
 * structured extraction via resume-parser.ts.
 *
 * Text-extraction libraries: `pdf-lib` (PDF structural validation) + `pdf-parse`
 * (PDF text-layer extraction), `mammoth` (DOCX -> text extraction).
 *
 * Scanned/image-based PDFs (no extractable text layer) are not supported —
 * OCR fallback isn't wired up. Callers get a clear error in that case rather
 * than a hang or garbage output.
 *
 * Install: npm install pdf-lib pdf-parse mammoth
 */

import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";

import {
  ParseResult,
  ParsedFileType,
  ServiceResult,
  success,
  failure,
} from "../models/resume.model";
import { parseResumeText } from "../utils/resume-parser";
import { detectFileType, assertFileSizeWithinLimit } from "../utils/resume-import";

/**
 * Extracts raw text from a PDF. pdf-lib does not do text extraction natively
 * (it's primarily a PDF *creation/manipulation* library), so text extraction
 * goes through pdf-parse; pdf-lib is only used here to validate the file
 * structurally. Scanned/image-based PDFs (no real text layer) throw a clear
 * error rather than attempting OCR, which isn't wired up.
 *
 * NOTE: For production text-layer extraction, pairing pdf-lib (structure)
 * with a text-extraction pass (e.g. `pdf-parse`) is recommended. This
 * function isolates that concern so swapping the text-layer extractor
 * later doesn't touch calling code.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; usedOcr: boolean }> {
  try {
    // Attempt structural load to validate the file & get page count.
    await PDFDocument.load(buffer, { ignoreEncryption: true });

    // Text-layer extraction via pdf-parse's v2 class-based API.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    let text: string;
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }

    if (text && text.trim().length > 50) {
      return { text, usedOcr: false };
    }

    // Text layer is empty/too short -> likely a scanned/image-based PDF.
    // NOTE: OCR fallback (rendering pages to images + Tesseract) is not
    // wired up yet — a previous version of this function attempted to OCR
    // the raw PDF bytes directly, which doesn't work (Tesseract expects an
    // image, not a PDF container) and would hang on Tesseract's worker/model
    // download while producing garbage output anyway. Fail clearly instead
    // of silently hanging or returning nonsense text.
    throw new Error(
      "This PDF has little to no extractable text (it may be scanned/image-based). " +
        "OCR for scanned PDFs isn't supported yet — please upload a text-based PDF/DOCX, " +
        "or paste the content directly into the editor."
    );
  } catch (err) {
    throw new Error(`Failed to extract text from PDF: ${(err as Error).message}`);
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractTextFromTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * Main entry point: takes a raw file buffer + filename/mime, detects type,
 * extracts text, and runs structured parsing. Never throws for parseable
 * input — returns `success: false` with warnings instead so the UI can
 * show "we couldn't fully parse this, please review".
 */
export async function parseResumeFile(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<ServiceResult<ParseResult>> {
  try {
    assertFileSizeWithinLimit(buffer.byteLength);
    const { type } = detectFileType(fileName, mimeType);

    let rawText = "";
    const warnings: string[] = [];

    switch (type) {
      case "pdf": {
        const { text, usedOcr } = await extractTextFromPdf(buffer);
        rawText = text;
        if (usedOcr) {
          warnings.push("This PDF appears to be scanned/image-based. Text was extracted via OCR and may contain errors — please review carefully.");
        }
        break;
      }
      case "docx":
        rawText = await extractTextFromDocx(buffer);
        break;
      case "txt":
        rawText = extractTextFromTxt(buffer);
        break;
      case "markdown":
        rawText = extractTextFromTxt(buffer);
        break;
      default:
        return failure("UNSUPPORTED_FILE_TYPE", `Unsupported file type: ${type}`);
    }

    if (!rawText || rawText.trim().length < 20) {
      warnings.push("Very little text could be extracted from this file. The result may be incomplete.");
    }

    const structuredContent = parseResumeText(rawText);

    const result: ParseResult = {
      success: rawText.trim().length > 0,
      content: structuredContent,
      rawText,
      warnings,
      sourceType: type,
    };

    return success(result);
  } catch (err) {
    return failure("PARSE_FAILED", (err as Error).message);
  }
}

export type { ParsedFileType };
