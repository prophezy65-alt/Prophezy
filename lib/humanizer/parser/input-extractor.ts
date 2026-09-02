// lib/humanizer/parser/input-extractor.ts
//
// Per the spec's "Reuse OCR / Reuse Parsers" instruction: PDF, DOCX, TXT,
// and Markdown extraction all delegate to lib/assignment/parser/text-parsers.ts
// rather than re-implementing pdf-parse/mammoth wiring in this module. Only
// HTML extraction is new here, since the Assignment module doesn't support
// it as an input format.
//
// Scanned/image-based PDFs are intentionally NOT run through OCR here —
// the Humanizer's job is to rewrite text that already exists, not to
// transcribe images. If a PDF has no extractable text layer, this throws a
// clear error asking the user to run it through Assignment AI's OCR first
// (which already exists and does that job well) and paste/upload the result.

import {
  extractPdfNativeText,
  extractDocxNativeText,
  extractPlainText,
  extractMarkdownText,
} from "@/lib/assignment/parser/text-parsers";
import type { HumanizerInputSource } from "../models/types";

export class ScannedPdfNotSupportedError extends Error {
  constructor() {
    super(
      "This PDF has no extractable text layer (it appears to be scanned). " +
        "Please run it through Assignment AI's OCR first, then paste or upload the extracted text here."
    );
    this.name = "ScannedPdfNotSupportedError";
  }
}

export async function extractInputText(buffer: Buffer, source: HumanizerInputSource): Promise<string> {
  switch (source) {
    case "pdf": {
      const result = await extractPdfNativeText(buffer);
      if (!result.hasExtractableText) throw new ScannedPdfNotSupportedError();
      return result.text;
    }
    case "docx": {
      const result = await extractDocxNativeText(buffer);
      return result.text;
    }
    case "txt":
      return extractPlainText(buffer).text;
    case "markdown":
      return extractMarkdownText(buffer).text;
    case "html":
      return stripHtmlToText(buffer.toString("utf-8"));
    case "plain_text":
      return buffer.toString("utf-8").trim();
  }
}

/** Minimal, dependency-free HTML-to-text conversion: strips tags, decodes
 * common entities, and collapses whitespace. Good enough for feeding into a
 * rewrite prompt, which only needs the readable content — not a full DOM
 * parse (a heavier dependency this module doesn't need). */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(h[1-6]|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
