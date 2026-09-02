/**
 * lib/document/embeddings/embedding.service.ts
 * Uses `embed()` from `lib/ai/config/client.ts` — listed in your README
 * alongside generate()/streamGenerate() — batched with bounded concurrency
 * so embedding a large document doesn't fire hundreds of simultaneous
 * requests at once.
 *
 * ASSUMPTION: `embed()`'s exact signature isn't shown in anything you've
 * shared (only its name, in the README table). Assumed here as
 * `embed(text: string, opts: { userId: string }) => Promise<number[]>` to
 * match the calling convention of `generate()`/`streamGenerate()` in
 * engine.ts. If the real signature differs, this is the one call site to
 * fix — `embedChunk`/`embedChunks` below are what everything else calls.
 */

import { embed } from "@/lib/ai/config/client";
import { EMBEDDING_DIMENSIONS } from "../constants/limits";
import type { Chunk, Embedding } from "../models/chunk.model";

const BATCH_CONCURRENCY = 5;

export const embeddingService = {
  async embedChunk(chunk: Chunk, userId: string): Promise<Embedding> {
    const vector = await embed(chunk.text);

    if (vector.length !== EMBEDDING_DIMENSIONS) {
      // Not fatal — different embedding models return different
      // dimensions — but worth surfacing since the pgvector column is
      // fixed-width and a mismatch will fail at insert time.
      // eslint-disable-next-line no-console
      console.warn(
        `embedding.service.ts: expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${vector.length}. ` +
          "Check the embed() model matches the vector column width in the migration."
      );
    }

    return { chunkId: chunk.id, vector, model: "gemini-embedding", dimensions: vector.length };
  },

  async embedChunks(chunks: Chunk[], userId: string): Promise<Embedding[]> {
    const results: Embedding[] = [];

    for (let i = 0; i < chunks.length; i += BATCH_CONCURRENCY) {
      const batch = chunks.slice(i, i + BATCH_CONCURRENCY);
      const batchResults = await Promise.all(batch.map((c) => this.embedChunk(c, userId)));
      results.push(...batchResults);
    }

    return results;
  },
};
