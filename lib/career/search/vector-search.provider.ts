/**
 * vector-search.provider.ts
 * Interface for semantic search backed by pgvector. The Career Guidance
 * Engine does not manage the database directly (per project constraints)
 * — this interface is implemented by the Database Backend engineer using
 * Supabase/pgvector, and injected into search.service.ts.
 *
 * Embeddings themselves are generated through the AI Core Engine (see
 * `providers/ai-core.provider.ts`), never called directly here either.
 */

import { SearchDomain, SearchResultItem } from "../models/career.model";

export interface VectorSearchRepository {
  /**
   * Performs a similarity search over pre-embedded records for a given
   * domain (career/company/skill/roadmap) using a query embedding vector.
   */
  similaritySearch(
    domain: SearchDomain,
    queryEmbedding: number[],
    limit: number
  ): Promise<SearchResultItem[]>;

  /**
   * Upserts an embedding for a record so it becomes searchable. Called by
   * ingestion jobs when catalog data changes, not on every request.
   */
  upsertEmbedding(domain: SearchDomain, id: string, text: string, embedding: number[]): Promise<void>;
}

/**
 * Stub implementation so this module compiles and is testable standalone.
 * Replace with the real pgvector-backed repository at app bootstrap.
 */
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
