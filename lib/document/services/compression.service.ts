/**
 * lib/document/services/compression.service.ts
 *
 * Real gzip compression (Node's built-in zlib, no extra dependency) for
 * large extracted text blobs before they're cached in Redis or stored in
 * `documents.metadata`/`processed_files` — the spec's PERFORMANCE section
 * asks for "Memory Optimization" and "Large File Support", and compressing
 * multi-hundred-KB extracted text before it sits in cache/DB is the
 * concrete lever available here.
 */

import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import { DocumentError } from "../errors/document-errors";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/** Below this size, compression overhead isn't worth it — return as-is. */
const MIN_BYTES_TO_COMPRESS = 2048;

export const compressionService = {
  async compress(text: string): Promise<{ compressed: boolean; data: Buffer | string }> {
    if (Buffer.byteLength(text, "utf-8") < MIN_BYTES_TO_COMPRESS) {
      return { compressed: false, data: text };
    }

    try {
      const buffer = await gzipAsync(Buffer.from(text, "utf-8"));
      return { compressed: true, data: buffer };
    } catch (err) {
      throw new DocumentError("Failed to compress text.", "COMPRESSION_ERROR", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async decompress(input: { compressed: boolean; data: Buffer | string }): Promise<string> {
    if (!input.compressed) return input.data as string;

    try {
      const buffer = await gunzipAsync(input.data as Buffer);
      return buffer.toString("utf-8");
    } catch (err) {
      throw new DocumentError("Failed to decompress text.", "COMPRESSION_ERROR", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
  },

  /** Ratio achieved, for analytics/telemetry — not required for correctness. */
  compressionRatio(originalBytes: number, compressedBytes: number): number {
    if (originalBytes === 0) return 0;
    return Number((1 - compressedBytes / originalBytes).toFixed(3));
  },
};
