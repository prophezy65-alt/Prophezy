// lib/assignment/parser/text-parsers.ts
// Native-text extraction paths — used when a file already contains a
// text layer (as opposed to scanned images, which route through ocr.service.ts).
//
// PDF and DOCX parsing rely on `pdf-parse` and `mammoth` respectively — both
// pure-JS/WASM libraries with no native binary dependency, safe for a
// serverless Next.js API route. These are peer dependencies of this module;
// add them to package.json if not already present:
//   npm install pdf-parse mammoth
//
// NOTE: as installed (pdf-parse@2.4.5), the package exports ONLY a class,
// `PDFParse` — there is no default function export and no `.parse()`
// instance method. The real API (confirmed against
// node_modules/pdf-parse/dist/pdf-parse/esm/PDFParse.d.ts) is:
//   const parser = new PDFParse({ data: <Uint8Array> });
//   const result = await parser.getText();   // { text, total, pages }
//   await parser.destroy();
// An earlier version of this file tried to defensively support several
// possible export shapes and, for the class-based one, called
// `new PDFParse()` with no arguments then `.parse(buffer)` — neither of
// which matches the real API. `new PDFParse()` with no `options` crashes
// inside the constructor (it reads `options.verbosity` to fill in a
// default logging level), and `.parse` doesn't exist on the class at all.

import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export interface NativeTextResult {
  text: string;
  pageCount: number | null;
  hasExtractableText: boolean;
}

const MIN_CHARS_PER_PAGE_FOR_NATIVE_TEXT = 20; // below this, assume the PDF page is a scan

export async function extractPdfNativeText(buffer: Buffer): Promise<NativeTextResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    const pageCount = result.total ?? null;

    const avgCharsPerPage = pageCount && pageCount > 0 ? text.length / pageCount : text.length;
    const hasExtractableText = avgCharsPerPage >= MIN_CHARS_PER_PAGE_FOR_NATIVE_TEXT;

    return { text, pageCount, hasExtractableText };
  } finally {
    await parser.destroy();
  }
}

export async function extractDocxNativeText(buffer: Buffer): Promise<NativeTextResult> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  return {
    text,
    pageCount: null, // DOCX has no fixed pagination pre-render
    hasExtractableText: text.length > 0,
  };
}

export function extractPlainText(buffer: Buffer): NativeTextResult {
  const text = buffer.toString("utf-8").trim();
  return { text, pageCount: null, hasExtractableText: text.length > 0 };
}

export function extractMarkdownText(buffer: Buffer): NativeTextResult {
  // Markdown is treated as plain text at the extraction layer; semantic
  // structure (headings, tables) is recovered later by table-parser.ts and
  // the AI structuring pass when needed.
  return extractPlainText(buffer);
}

const CODE_FENCE_LANG_HINT: Record<string, string> = {
  py: "python", js: "javascript", ts: "typescript", tsx: "tsx", jsx: "jsx",
  java: "java", c: "c", cpp: "cpp", cs: "csharp", go: "go", rb: "ruby",
  php: "php", sql: "sql", rs: "rust", kt: "kotlin", swift: "swift",
};

export function extractCodeFile(buffer: Buffer, fileName: string): NativeTextResult & { language: string } {
  const text = buffer.toString("utf-8");
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const language = CODE_FENCE_LANG_HINT[ext] ?? "text";
  return { text, pageCount: null, hasExtractableText: text.trim().length > 0, language };
}
