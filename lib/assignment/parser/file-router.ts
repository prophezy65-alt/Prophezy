// lib/assignment/parser/file-router.ts
import type { SupportedMimeCategory } from "../models/types";

const CATEGORY_BY_EXTENSION: Record<string, SupportedMimeCategory> = {
  pdf: "pdf",
  docx: "docx",
  doc: "docx",
  txt: "txt",
  md: "markdown",
  markdown: "markdown",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  bmp: "image",
  tiff: "image",
  zip: "zip",
  ppt: "pptx",
  pptx: "pptx",
  py: "code",
  js: "code",
  ts: "code",
  tsx: "code",
  jsx: "code",
  java: "code",
  c: "code",
  cpp: "code",
  cs: "code",
  go: "code",
  rb: "code",
  php: "code",
  sql: "code",
  rs: "code",
  kt: "code",
  swift: "code",
};

const CATEGORY_BY_MIME: Record<string, SupportedMimeCategory> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "markdown",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export class UnsupportedFileTypeError extends Error {
  constructor(fileName: string, mimeType: string) {
    super(`Unsupported file type for "${fileName}" (mime: ${mimeType})`);
    this.name = "UnsupportedFileTypeError";
  }
}

export function resolveFileCategory(fileName: string, mimeType: string): SupportedMimeCategory {
  if (CATEGORY_BY_MIME[mimeType]) return CATEGORY_BY_MIME[mimeType];

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (CATEGORY_BY_EXTENSION[ext]) return CATEGORY_BY_EXTENSION[ext];

  throw new UnsupportedFileTypeError(fileName, mimeType);
}

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per file
export const MAX_ZIP_ENTRIES = 200; // guard against zip bombs

export function assertWithinSizeLimit(sizeBytes: number, fileName: string): void {
  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `File "${fileName}" (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds the ${
        MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
      }MB upload limit`
    );
  }
}
