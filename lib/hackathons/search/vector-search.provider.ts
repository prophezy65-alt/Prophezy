/**
 * vector-search.provider.ts
 * Interface for semantic search over hackathons/technologies/themes,
 * backed by pgvector in production. Implemented by the Database Backend
 * layer and injected into search.service.ts. Embeddings are generated
 * through the AI Core Engine, never called directly here.
 */

import { SearchDomain, SearchResultItem } from "../models/hackathon.model";

export interface VectorSearchRepository {
  similaritySearch(domain: SearchDomain, queryEmbedding: number[], limit: number): Promise<SearchResultItem[]>;
  upsertEmbedding(domain: SearchDomain, id: string, text: string, embedding: number[]): Promise<void>;
}

export function createStubVectorSearchRepository(): VectorSearchRepository {
  return {
    async similaritySearch() {
      return [];
    },
    async upsertEmbedding() {
      // no-op
    },
  };
}
