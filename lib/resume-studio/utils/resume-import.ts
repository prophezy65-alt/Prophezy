/**
 * resume-import.ts
 * Detects incoming file type from filename/mime and normalizes it into the
 * ParsedFileType used by parser.service.ts. Also handles plain-text/markdown
 * pass-through so the parser has one consistent entry point.
 */

import { ParsedFileType } from "../models/resume.model";

const MIME_MAP: Record<string, ParsedFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "markdown",
};

const EXTENSION_MAP: Record<string, ParsedFileType> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "markdown",
  markdown: "markdown",
};

export interface DetectedFile {
  type: ParsedFileType;
  fileName: string;
}

/**
 * Detects file type from mime type first, falling back to file extension.
 * Throws a descriptive error for unsupported types so the API route can
 * return a clean 400 rather than a generic 500.
 */
export function detectFileType(fileName: string, mimeType?: string): DetectedFile {
  if (mimeType && MIME_MAP[mimeType]) {
    return { type: MIME_MAP[mimeType], fileName };
  }

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const type = EXTENSION_MAP[extension];

  if (!type) {
    throw new Error(
      `Unsupported file type for "${fileName}". Supported: PDF, DOCX, TXT, Markdown.`
    );
  }

  return { type, fileName };
}

export const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function assertFileSizeWithinLimit(sizeBytes: number): void {
  if (sizeBytes > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error(
      `File too large (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB). Max size is 10MB.`
    );
  }
}
