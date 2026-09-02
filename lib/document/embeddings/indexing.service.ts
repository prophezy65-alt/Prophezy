/**
 * lib/document/embeddings/indexing.service.ts
 * Persists chunks to `document_chunks` and their vectors to
 * `document_embeddings` (see supabase/migrations/0022_document_intelligence.sql).
 *
 * ASSUMPTION: same Supabase client wrapper assumption as the Flashcards
 * Engine — `getSupabaseServerClient()` at `@/lib/supabase/server`.
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { DocumentError } from "../errors/document-errors";
import type { Chunk, Embedding } from "../models/chunk.model";

export const indexingService = {
  async indexChunks(chunks: Chunk[], embeddings: Embedding[]): Promise<void> {
    if (chunks.length === 0) return;
    const supabase = await getSupabaseServerClient();

    const chunkRows = chunks.map((c) => ({
      id: c.id,
      document_id: c.documentId,
      chunk_index: c.index,
      text: c.text,
      strategy: c.strategy,
      start_page_index: c.startPageIndex,
      end_page_index: c.endPageIndex,
      token_estimate: c.tokenEstimate,
      metadata: c.metadata as unknown as Json,
    }));

    const { error: chunkError } = await supabase.from("document_chunks").upsert(chunkRows);
    if (chunkError) {
      throw new DocumentError("Failed to index document chunks.", "INDEXING_ERROR", { cause: chunkError.message });
    }

    const embeddingRows = embeddings.map((e) => ({
      chunk_id: e.chunkId,
      embedding: JSON.stringify(e.vector),
      model: e.model,
      dimensions: e.dimensions,
    }));

    const { error: embError } = await supabase.from("document_embeddings").upsert(embeddingRows, { onConflict: "chunk_id" });
    if (embError) {
      throw new DocumentError("Failed to index document embeddings.", "INDEXING_ERROR", { cause: embError.message });
    }
  },

  async reindexDocument(documentId: string): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("document_chunks").delete().eq("document_id", documentId);
    if (error) {
      throw new DocumentError("Failed to clear existing chunks before reindexing.", "INDEXING_ERROR", { cause: error.message });
    }
    // Caller (document.service.ts) is expected to re-run chunking + embedChunks + indexChunks after this.
  },
};
