/**
 * lib/document/constants/limits.ts
 */

/**
 * FIX: previously a single hardcoded MAX_UPLOAD_BYTES (100MB) for every
 * format, completely disconnected from MAX_FILE_SIZE_MB / MAX_PDF_SIZE_MB
 * already sitting in .env — those two env vars were dead config, read by
 * nothing. This now actually reads them, with a fallback if unset/invalid,
 * and gives PDFs their own (larger) ceiling than other formats — PDFs are
 * routinely bigger (scanned pages, embedded images) than a .docx/.txt, so
 * one shared limit for everything was always going to be wrong for one
 * side or the other.
 *
 * To raise the ceiling further: set MAX_PDF_SIZE_MB in .env to whatever
 * you actually need, then restart `next dev` (env vars are only read at
 * process start, same as everywhere else in this project). No code change
 * needed for that going forward.
 */
function readMaxSizeMb(envVar: string, fallbackMb: number): number {
  const raw = process.env[envVar];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMb;
}

export const MAX_UPLOAD_BYTES = readMaxSizeMb("MAX_FILE_SIZE_MB", 25) * 1024 * 1024;
/** PDFs get their own, larger ceiling — see header comment. Fallback of
 *  150MB chosen to comfortably cover a large scanned/image-heavy paper;
 *  raise via MAX_PDF_SIZE_MB in .env if you hit it again. */
export const MAX_PDF_UPLOAD_BYTES = readMaxSizeMb("MAX_PDF_SIZE_MB", 150) * 1024 * 1024;

export const MAX_ZIP_ENTRY_COUNT = 300;
export const MAX_ZIP_ENTRY_BYTES = 25 * 1024 * 1024;
export const MAX_PAGES_SYNC = 50; // beyond this, document.service.ts should route to background processing
export const MAX_OCR_IMAGE_DIMENSION = 6000; // px, guards against decompression-bomb style images

export const MIME_BY_EXTENSION: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  markdown: ["text/markdown", "text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  json: ["application/json"],
  html: ["text/html"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

/** Magic-byte signatures for the formats where extension spoofing is cheap and common. */
export const MAGIC_BYTES: Record<string, string> = {
  pdf: "25504446", // %PDF
  png: "89504e47",
  jpg: "ffd8ff",
  zip: "504b0304", // also docx/xlsx/pptx, which are zip containers
};

export const DEFAULT_CHUNK_CHARS = 1500;
export const DEFAULT_CHUNK_OVERLAP = 200;
export const EMBEDDING_DIMENSIONS = 768;
