/**
 * lib/document/providers/pdf.provider.ts
 *
 * Uses `pdf-parse` (in your stack) for native text-layer extraction. If a
 * page comes back with near-zero extractable text (scanned/image-only
 * page), parser.service.ts routes that page to the OCR pipeline instead —
 * this provider's job is just to report which pages need that, not to do
 * OCR itself.
 */

import { PDFParse } from "pdf-parse";
import type { Page } from "../models/page.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";
import { ParsingError } from "../errors/document-errors";

export interface PdfParseResult {
  pages: Page[];
  metadata: DocumentMetadata;
  rawText: string;
}

/** Below this char-count per page, we treat it as "no usable text layer". */
const MIN_CHARS_FOR_TEXT_LAYER = 20;

export async function parsePdf(buffer: Buffer, fileSizeBytes: number): Promise<PdfParseResult> {
  const parser = new PDFParse({ data: buffer });
  let result: { text: string; info: Record<string, unknown> | undefined; numpages: number };
  try {
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    result = { text: textResult.text, info: infoResult.info, numpages: infoResult.total };
  } catch (err) {
    throw new ParsingError("Failed to parse PDF.", { cause: err instanceof Error ? err.message : String(err) });
  } finally {
    await parser.destroy();
  }

  // pdf-parse gives combined text, not clean per-page splits by default.
  // It inserts form-feed characters (\f) between pages in most builds —
  // fall back to a single "page 1" if that separator isn't present so we
  // never silently drop content.
  const rawPages = result.text.includes("\f") ? result.text.split("\f") : [result.text];

  const pages: Page[] = rawPages.map((text, i) => {
    const trimmed = text.trim();
    const wordCount = trimmed.length ? trimmed.split(/\s+/).length : 0;
    return {
      index: i,
      pageNumber: i + 1,
      text: trimmed,
      wordCount,
      hasImages: false, // pdf-parse doesn't report this; left for a future image-aware pass
      hasTables: false, // heuristically set later by extractor.service.ts
      ocrApplied: false,
      ocrConfidence: trimmed.length < MIN_CHARS_FOR_TEXT_LAYER ? 0 : null,
    };
  });

  const info = result.info ?? {};
  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    title: (info.Title as string) || null,
    authors: info.Author ? [String(info.Author)] : [],
    createdDate: (info.CreationDate as string) || null,
    modifiedDate: (info.ModDate as string) || null,
    pageCount: result.numpages ?? pages.length,
    wordCount: pages.reduce((sum, p) => sum + p.wordCount, 0),
    fileSizeBytes,
    mimeType: "application/pdf",
  };

  return { pages, metadata, rawText: result.text };
}

/** Pages whose text layer is effectively empty and should be sent through OCR. */
export function pagesNeedingOcr(pages: Page[]): number[] {
  return pages.filter((p) => p.text.length < MIN_CHARS_FOR_TEXT_LAYER).map((p) => p.index);
}
