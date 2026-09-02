/**
 * lib/document/providers/json.provider.ts
 * Not in the SERVICES/PROVIDERS list explicitly but JSON is a supported
 * file type — flattens arbitrary JSON into readable text + preserves the
 * parsed structure in metadata.custom for consumers that want raw access.
 */

import type { Page } from "../models/page.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";
import { ParsingError } from "../errors/document-errors";

export interface JsonParseResult {
  pages: Page[];
  metadata: DocumentMetadata;
  parsed: unknown;
}

export function parseJson(text: string, fileSizeBytes: number): JsonParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ParsingError("Failed to parse JSON.", { cause: err instanceof Error ? err.message : String(err) });
  }

  const flattened = flattenToText(parsed);
  const wordCount = flattened.trim().length ? flattened.trim().split(/\s+/).length : 0;

  const pages: Page[] = [
    { index: 0, pageNumber: 1, text: flattened, wordCount, hasImages: false, hasTables: false, ocrApplied: false, ocrConfidence: null },
  ];

  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    pageCount: 1,
    wordCount,
    fileSizeBytes,
    mimeType: "application/json",
  };

  return { pages, metadata, parsed };
}

function flattenToText(value: unknown, path = ""): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return `${path}: ${String(value)}`;

  const lines: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => lines.push(flattenToText(item, `${path}[${i}]`)));
  } else {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      lines.push(flattenToText(val, path ? `${path}.${key}` : key));
    }
  }
  return lines.filter(Boolean).join("\n");
}
