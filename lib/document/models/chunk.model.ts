/**
 * lib/document/models/chunk.model.ts
 */

import type { ChunkStrategy } from "../types/document.types";

export interface Chunk {
  id: string;
  documentId: string;
  index: number;
  text: string;
  strategy: ChunkStrategy;
  startPageIndex: number;
  endPageIndex: number;
  tokenEstimate: number;
  metadata: Record<string, unknown>;
}

export interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  strategy: string;
  start_page_index: number;
  end_page_index: number;
  token_estimate: number;
  metadata: Record<string, unknown>;
}

export function rowToChunk(row: ChunkRow): Chunk {
  return {
    id: row.id,
    documentId: row.document_id,
    index: row.chunk_index,
    text: row.text,
    strategy: row.strategy as ChunkStrategy,
    startPageIndex: row.start_page_index,
    endPageIndex: row.end_page_index,
    tokenEstimate: row.token_estimate,
    metadata: row.metadata ?? {},
  };
}

export interface Embedding {
  chunkId: string;
  vector: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingRow {
  chunk_id: string;
  embedding: number[];
  model: string;
  dimensions: number;
}
