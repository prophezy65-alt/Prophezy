/**
 * lib/document/validation/file-security.ts
 *
 * Defense-in-depth ahead of any parser touching a file: extension/MIME
 * agreement, magic-byte sniffing for the formats extension-spoofing usually
 * targets, size limits, and zip-bomb / zip-slip guards. This runs BEFORE
 * `lib/ai/middleware/safety.ts` ever sees extracted text — it's about the
 * bytes on disk, not the content.
 */

import {
  MAX_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_BYTES,
  MAX_ZIP_ENTRY_COUNT,
  MAX_ZIP_ENTRY_BYTES,
  MIME_BY_EXTENSION,
  MAGIC_BYTES,
} from "../constants/limits";
import { FileValidationError, MaliciousFileError } from "../errors/document-errors";
import type { FileFormat } from "../types/document.types";

export interface FileValidationInput {
  filename: string;
  format: FileFormat;
  mimeType: string;
  sizeBytes: number;
  /** First ~16 bytes of the file, hex-encoded, for magic-byte verification. Optional but recommended. */
  headerHex?: string;
}

export function assertValidFile(input: FileValidationInput): void {
  // FIX: PDFs now get their own (larger) ceiling instead of sharing the
  // generic MAX_UPLOAD_BYTES with every other format — see limits.ts.
  const maxBytes = input.format === "pdf" ? MAX_PDF_UPLOAD_BYTES : MAX_UPLOAD_BYTES;

  if (input.sizeBytes <= 0 || input.sizeBytes > maxBytes) {
    throw new FileValidationError("File exceeds the maximum allowed upload size.", {
      filename: input.filename,
      sizeBytes: input.sizeBytes,
      maxBytes,
    });
  }

  const allowedMimes = MIME_BY_EXTENSION[input.format] ?? [];
  if (allowedMimes.length > 0 && !allowedMimes.includes(input.mimeType)) {
    throw new FileValidationError("File extension does not match its declared content type.", {
      filename: input.filename,
      format: input.format,
      declaredMime: input.mimeType,
      expectedMimes: allowedMimes,
    });
  }

  const expectedMagic = MAGIC_BYTES[input.format];
  if (expectedMagic && input.headerHex) {
    const normalizedHeader = input.headerHex.toLowerCase().replace(/\s/g, "");
    if (!normalizedHeader.startsWith(expectedMagic)) {
      throw new MaliciousFileError(
        "File contents do not match its declared format (magic-byte mismatch) — possible spoofed or corrupted upload.",
        { filename: input.filename, format: input.format }
      );
    }
  }
}

export interface ZipEntryInfo {
  name: string;
  sizeBytes: number;
  compressedSizeBytes: number;
}

export function assertSafeZipEntries(entries: ZipEntryInfo[]): void {
  if (entries.length > MAX_ZIP_ENTRY_COUNT) {
    throw new MaliciousFileError("Archive contains too many files.", { count: entries.length });
  }

  let totalUncompressed = 0;

  for (const entry of entries) {
    if (entry.name.includes("..") || entry.name.startsWith("/") || entry.name.includes("\0")) {
      throw new MaliciousFileError("Archive contains an unsafe path (zip-slip attempt).", {
        entry: entry.name,
      });
    }

    if (entry.sizeBytes > MAX_ZIP_ENTRY_BYTES) {
      throw new MaliciousFileError("An archive entry exceeds the per-file size limit.", {
        entry: entry.name,
        sizeBytes: entry.sizeBytes,
      });
    }

    // Zip-bomb heuristic: absurd compression ratios (e.g. 1KB -> 1GB) get
    // flagged even if the individual entry is under the byte cap.
    if (entry.compressedSizeBytes > 0) {
      const ratio = entry.sizeBytes / entry.compressedSizeBytes;
      if (ratio > 1000) {
        throw new MaliciousFileError("Archive entry has a suspicious compression ratio (possible zip bomb).", {
          entry: entry.name,
          ratio: Number(ratio.toFixed(1)),
        });
      }
    }

    totalUncompressed += entry.sizeBytes;
  }

  if (totalUncompressed > MAX_UPLOAD_BYTES * 5) {
    throw new MaliciousFileError("Archive's total uncompressed size is unreasonably large.", {
      totalUncompressedBytes: totalUncompressed,
    });
  }
}

/**
 * Same conservative instruction-injection heuristic used by the Flashcards
 * Engine's ingestion path — flags rather than silently rewrites, since study
 * material *about* prompt injection is legitimate content, not an attack.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|the|any) (previous|prior|above) instructions/i,
  /you are now (a|an|in) [\w\s]+ mode/i,
  /system\s*:\s*override/i,
  /disregard (your|all) (guidelines|rules|instructions)/i,
  /reveal (your|the) (system prompt|instructions|api key)/i,
];

export interface TextScanResult {
  flagged: boolean;
  matches: string[];
}

export function scanTextForInjection(text: string): TextScanResult {
  const matches = INJECTION_PATTERNS.filter((p) => p.test(text)).map((p) => p.source);
  return { flagged: matches.length > 0, matches };
}
