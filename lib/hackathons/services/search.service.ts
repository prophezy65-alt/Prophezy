/**
 * search.service.ts
 * Search across hackathon/technology/theme/organizer/company domains.
 * Prefers vector (pgvector) similarity search when available; always has
 * a deterministic keyword-search fallback over the current hackathon set.
 */

import { SearchQuery, SearchResultItem, ServiceResult, success, failure } from "../models/hackathon.model";
import { searchQuerySchema, validate } from "../validation/hackathon.validation";
import { VectorSearchRepository } from "../search/vector-search.provider";
import { keywordSearch } from "../search/keyword-search";
import { HackathonService } from "./hackathon.service";
import { logger } from "../utils/logger";

export type EmbeddingFn = (text: string) => Promise<number[]>;

export class SearchService {
  constructor(
    private readonly hackathonService: HackathonService,
    private readonly vectorSearchRepo?: VectorSearchRepository,
    private readonly embed?: EmbeddingFn
  ) {}

  async search(query: SearchQuery): Promise<ServiceResult<SearchResultItem[]>> {
    const validation = validate(searchQuerySchema, query);
    if (!validation.success) {
      return failure("VALIDATION_ERROR", "Invalid search query.", validation.errors);
    }

    const { domain, query: queryText, limit = 10 } = validation.data;

    if (this.vectorSearchRepo && this.embed) {
      try {
        const embedding = await this.embed(queryText);
        const vectorResults = await this.vectorSearchRepo.similaritySearch(domain, embedding, limit);
        if (vectorResults.length > 0) return success(vectorResults);
      } catch (error) {
        logger.warn("Vector search failed, falling back to keyword search", { domain, error: (error as Error).message });
      }
    }

    const page = await this.hackathonService.list(validation.data.filters, undefined, 500, false);
    const hackathons = page.ok && page.data ? page.data.items : [];

    return success(keywordSearch(hackathons, domain, queryText, limit));
  }
}
