// lib/assignment/services/parser.service.ts
// Orchestrates extraction for a single uploaded file: picks the right parser
// based on category, converts PDFs/images to page buffers when OCR is
// needed, and returns a unified StructuredExtraction regardless of source
// format. This is the single entry point services/assignment.service.ts
// calls per file — it never needs to know about pdf-parse vs mammoth vs
// Tesseract internals.

import type { UploadedAssignmentFile, StructuredExtraction, ExtractedPage } from "../models/types";
import { extractPdfNativeText, extractDocxNativeText, extractPlainText, extractMarkdownText, extractCodeFile } from "../parser/text-parsers";
import { expandZipArchive, extractPptxText } from "../parser/archive-parsers";
import { runOcrPipeline } from "./ocr.service";
import { extractMarkdownTables, extractAlignedTables } from "../utils/table-parser";
import { extractEquations } from "../utils/equation-parser";
import { rasterizePdfPages } from "./pdf-render.util";

export interface ParseFileOptions {
  userId: string;
}

/** Parses a single uploaded file (already fetched into memory) into a
 * StructuredExtraction. ZIP files are the one exception: they expand into
 * MULTIPLE files, so callers should check `isArchive` and iterate. */
export async function parseUploadedFile(
  file: UploadedAssignmentFile,
  buffer: Buffer,
  options: ParseFileOptions
): Promise<StructuredExtraction | { isArchive: true; entries: { fileName: string; buffer: Buffer }[] }> {
  switch (file.category) {
    case "txt":
      return wrapNativeText(file.id, extractPlainText(buffer).text);

    case "markdown":
      return wrapNativeText(file.id, extractMarkdownText(buffer).text);

    case "code": {
      const { text, language } = extractCodeFile(buffer, file.originalName);
      return wrapNativeText(file.id, text, { isCode: true, language });
    }

    case "docx": {
      const { text } = await extractDocxNativeText(buffer);
      return wrapNativeText(file.id, text);
    }

    case "pptx": {
      const slides = await extractPptxText(buffer);
      const text = slides.map((s) => `--- Slide ${s.slideNumber} ---\n${s.text}`).join("\n\n");
      return wrapNativeText(file.id, text);
    }

    case "zip": {
      const entries = await expandZipArchive(buffer);
      return { isArchive: true, entries: entries.map((e) => ({ fileName: e.fileName, buffer: e.buffer })) };
    }

    case "pdf": {
      const native = await extractPdfNativeText(buffer);
      if (native.hasExtractableText) {
        return wrapNativeText(file.id, native.text);
      }
      // Scanned PDF — rasterize pages to images and run the OCR pipeline.
      const pageImages = await rasterizePdfPages(buffer);
      return runOcrPipeline(
        pageImages.map((img) => ({ pageNumber: img.pageNumber, imageBuffer: img.pngBuffer, mimeType: "image/png" })),
        { userId: options.userId, fileId: file.id }
      );
    }

    case "image": {
      return runOcrPipeline([{ pageNumber: 1, imageBuffer: buffer, mimeType: file.mimeType }], {
        userId: options.userId,
        fileId: file.id,
      });
    }
  }
}

function wrapNativeText(
  fileId: string,
  text: string,
  meta?: { isCode?: boolean; language?: string }
): StructuredExtraction {
  const page: ExtractedPage = {
    pageNumber: 1,
    rawText: text,
    confidence: 1.0,
    source: "native_text",
  };

  const tables = meta?.isCode ? [] : (extractMarkdownTables(text).length ? extractMarkdownTables(text) : extractAlignedTables(text));
  const equations = meta?.isCode ? [] : extractEquations(text);

  return {
    fileId,
    pages: [page],
    tables,
    equations,
    figures: [],
    fullText: text,
    language: "en",
    hasHandwriting: false,
    extractionWarnings: [],
  };
}
