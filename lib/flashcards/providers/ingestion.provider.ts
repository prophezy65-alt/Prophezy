/**
 * lib/flashcards/providers/ingestion.provider.ts
 *
 * REWRITTEN: the original assumed PDF/DOCX/PPTX extractor functions on
 * lib/ai/utils/parser.ts — that file turned out to only handle markdown
 * section-splitting, code-block/Mermaid extraction, and CSV parsing, with
 * no document extractors at all. The real target is the Document
 * Intelligence Engine at @/lib/document (`documentService.process()`),
 * which already handles pdf/docx/ppt/pptx/zip (recursively) in one call,
 * including OCR fallback for image-heavy pages internally. Nothing else in
 * the codebase was calling it yet.
 *
 * Image-only sources (image/handwritten) still go through ocr.provider.ts,
 * which now wraps the real lib/ai/services/ocr.service.ts#ocrImage.
 *
 * `fileRef`, for every file-based source type, is an `uploads.id` (uuid) —
 * the same identifier /api/uploads/[id] already addresses files by. Bytes
 * are fetched via upload-fetch.provider.ts (new, local to this module).
 */

import type { FileFormat } from "@/lib/document";
import { sanitizeIngestedText } from "../validation/sanitize";
import { runOcr } from "./ocr.provider";
import { fetchUploadBuffer } from "./upload-fetch.provider";
import type { SourceType } from "../models/deck.model";
import { splitByHeadings, extractCodeBlocks } from "@/lib/ai/utils/parser";

export interface IngestionInput {
  sourceType: SourceType;
  userId: string;
  /** uploads.id (uuid) for file-based sources; ignored for plain_text/notes_ai/etc. */
  fileRef?: string;
  /** Direct text for plain_text/notes_ai/etc, the URL string for source type "url", or inline markdown/txt content. */
  text?: string;
  mimeType?: string;
}

export interface IngestedDocument {
  text: string;
  sections: { heading: string; content: string }[];
  codeBlocks: string[];
  flaggedForInjection: boolean;
}

const SOURCE_TYPE_TO_DOCUMENT_FORMAT: Partial<Record<SourceType, FileFormat>> = {
  pdf: "pdf",
  scanned_pdf: "pdf",
  docx: "docx",
  ppt: "ppt",
  pptx: "pptx",
  zip: "zip",
  markdown: "markdown",
  txt: "txt",
};

/** Runs a file-based source through the real Document Intelligence Engine and returns its combined page text. */
async function extractViaDocumentEngine(sourceType: SourceType, uploadId: string, userId: string): Promise<string> {
  const format = SOURCE_TYPE_TO_DOCUMENT_FORMAT[sourceType];
  if (!format) {
    throw new Error(`ingestion.provider.ts: no document format mapping for source type "${sourceType}".`);
  }

  const { buffer, mimeType, filename } = await fetchUploadBuffer(uploadId, userId);

  // FIX: this was a static top-level import of "@/lib/document", which pulls in
  // a PDF-parsing library that references DOMMatrix (a browser-only API) at
  // module load time. Because decks/route.ts statically imports this whole file
  // (via lib/flashcards's index -> generator.service -> here), EVERY request to
  // /api/flashcards/decks — including a plain GET that never touches a PDF —
  // was crashing the entire module with "ReferenceError: DOMMatrix is not
  // defined" before the handler even ran. Loading it lazily, only when a file
  // actually needs extraction, keeps that cost out of routes that don't need it.
  const { documentService } = await import("@/lib/document");

  const doc = await documentService.process({
    userId,
    ownerModule: "flashcards_ai",
    filename,
    format,
    buffer,
    mimeType,
    // Flashcards does its own concept extraction downstream (concept.service.ts) —
    // skip the Document Engine's extra AI topic-extraction round-trip.
    extractTopics: false,
    runOcr: sourceType === "scanned_pdf",
  });

  const rawText = doc.pages.map((p) => p.text).join("\n\n");

  if (!rawText.trim()) {
    throw new Error(
      `ingestion.provider.ts: "${sourceType}" document produced no extractable text. If this is a scanned ` +
        `document with no selectable text layer, page-level OCR rasterization isn't wired anywhere in the ` +
        `codebase yet — lib/document/parser/parser.service.ts's own "pdf" case flags this exact gap in a code ` +
        `comment. Try the "image" source type instead (upload individual page screenshots), which does OCR ` +
        `via ocr.provider.ts.`
    );
  }

  return rawText;
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch URL for ingestion: ${url} (${res.status})`);
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (contentType.includes("html")) {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return raw;
}

export async function ingestDocument(input: IngestionInput): Promise<IngestedDocument> {
  let rawText: string;

  switch (input.sourceType) {
    case "plain_text":
    case "notes_ai":
    case "assignment_ai":
    case "syllabus_ai":
    case "research_ai":
      if (!input.text) throw new Error(`ingestDocument: 'text' is required for source type ${input.sourceType}`);
      rawText = input.text;
      break;

    case "markdown":
    case "txt":
      if (input.text) {
        rawText = input.text;
      } else if (input.fileRef) {
        rawText = await extractViaDocumentEngine(input.sourceType, input.fileRef, input.userId);
      } else {
        throw new Error("ingestDocument: text or fileRef required");
      }
      break;

    case "pdf":
    case "docx":
    case "ppt":
    case "pptx":
    case "zip":
      if (!input.fileRef) throw new Error(`ingestDocument: fileRef required for ${input.sourceType}`);
      rawText = await extractViaDocumentEngine(input.sourceType, input.fileRef, input.userId);
      break;

    case "scanned_pdf":
      if (!input.fileRef) throw new Error("ingestDocument: fileRef required for scanned_pdf");
      rawText = await extractViaDocumentEngine("scanned_pdf", input.fileRef, input.userId);
      break;

    case "image":
    case "handwritten": {
      if (!input.fileRef) throw new Error("ingestDocument: fileRef required for image-based sources");
      const ocr = await runOcr({
        fileRef: input.fileRef,
        mimeType: (input.mimeType as OcrInputMime) ?? "image/png",
        userId: input.userId,
      });
      rawText = ocr.text;
      break;
    }

    case "url":
      if (!input.text) throw new Error("ingestDocument: 'text' must contain the URL for source type url");
      rawText = await fetchUrlText(input.text);
      break;

    default:
      throw new Error(`ingestDocument: unsupported source type ${input.sourceType}`);
  }

  const sanitized = sanitizeIngestedText(rawText);
  const sections = Object.entries(splitByHeadings(sanitized.clean)).map(([heading, content]) => ({ heading, content }));
  const codeBlocks = extractCodeBlocks(sanitized.clean).map((b) => b.code);

  return {
    text: sanitized.clean,
    sections,
    codeBlocks,
    flaggedForInjection: sanitized.flagged,
  };
}

type OcrInputMime = "image/png" | "image/jpeg" | "application/pdf";
