/**
 * lib/opportunities/models/search.model.ts
 *
 * Backs the `search_index` table (one denormalized, precomputed row per
 * `Opportunity`, optimized for filtering/sorting/full-text search without
 * joining across `opportunities`, `opportunity_tags`, etc. on every
 * query) plus the query/result/facet shapes the search service exchanges
 * with callers.
 */

import { ExperienceLevel, OpportunityStatus, OpportunityType, SearchSortField, SortDirection, WorkMode } from "./enums";
import { DateRange, ISODateString, UUID, isNonEmptyString, isUUID, isValidDateRange } from "./shared.model";

/**
 * One row of `search_index`. Rebuilt (or incrementally updated) whenever
 * its source `Opportunity` changes — see `search/` and `indexing`
 * responsibilities in `services/`.
 */
export interface SearchIndexRow {
  readonly opportunityId: UUID;
  readonly type: OpportunityType;
  readonly status: OpportunityStatus;
  readonly title: string;
  readonly organizationName: string;
  /** Concatenated, lowercased searchable text (title + description + org + tags) for keyword search. */
  readonly searchText: string;
  readonly categories: readonly string[];
  readonly technologies: readonly string[];
  readonly workMode: WorkMode;
  readonly city: string | null;
  readonly country: string | null;
  readonly experienceLevel: ExperienceLevel;
  readonly eligibleCountries: readonly string[];
  readonly applicationDeadline: ISODateString | null;
  readonly postedAt: ISODateString | null;
  readonly indexedAt: ISODateString;
}

export interface SearchQuery {
  readonly keyword: string | null;
  readonly types: readonly OpportunityType[];
  readonly categories: readonly string[];
  readonly technologies: readonly string[];
  readonly workModes: readonly WorkMode[];
  readonly countries: readonly string[];
  readonly city: string | null;
  readonly organizationName: string | null;
  readonly experienceLevels: readonly ExperienceLevel[];
  readonly deadlineRange: DateRange;
  readonly postedRange: DateRange;
  readonly statuses: readonly OpportunityStatus[];
  readonly sortField: SearchSortField;
  readonly sortDirection: SortDirection;
  readonly page: number; // 1-indexed
  readonly pageSize: number;
}

export const DEFAULT_SEARCH_QUERY: SearchQuery = {
  keyword: null,
  types: [],
  categories: [],
  technologies: [],
  workModes: [],
  countries: [],
  city: null,
  organizationName: null,
  experienceLevels: [],
  deadlineRange: { from: null, to: null },
  postedRange: { from: null, to: null },
  statuses: [OpportunityStatus.ACTIVE],
  sortField: SearchSortField.RELEVANCE,
  sortDirection: SortDirection.DESC,
  page: 1,
  pageSize: 20,
};

export interface FacetBucket {
  readonly value: string;
  readonly count: number;
}

export interface SearchFacets {
  readonly types: readonly FacetBucket[];
  readonly categories: readonly FacetBucket[];
  readonly technologies: readonly FacetBucket[];
  readonly workModes: readonly FacetBucket[];
  readonly countries: readonly FacetBucket[];
}

export interface SearchResult {
  readonly rows: readonly SearchIndexRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly facets: SearchFacets;
  readonly tookMs: number;
}

const MAX_PAGE_SIZE = 100;

export function validateSearchQuery(query: SearchQuery): string[] {
  const problems: string[] = [];

  if (query.page < 1) problems.push("SearchQuery.page must be >= 1.");
  if (query.pageSize < 1 || query.pageSize > MAX_PAGE_SIZE) {
    problems.push(`SearchQuery.pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
  }
  if (!isValidDateRange(query.deadlineRange)) problems.push("SearchQuery.deadlineRange is invalid.");
  if (!isValidDateRange(query.postedRange)) problems.push("SearchQuery.postedRange is invalid.");
  if (query.keyword !== null && query.keyword.trim().length === 0) {
    problems.push("SearchQuery.keyword must be null or a non-empty string.");
  }

  return problems;
}

export function validateSearchIndexRow(row: SearchIndexRow): string[] {
  const problems: string[] = [];
  if (!isUUID(row.opportunityId)) problems.push("SearchIndexRow.opportunityId must be a UUID.");
  if (!isNonEmptyString(row.title)) problems.push("SearchIndexRow.title is required.");
  if (!isNonEmptyString(row.searchText)) problems.push("SearchIndexRow.searchText is required.");
  if (row.searchText !== row.searchText.toLowerCase()) {
    problems.push("SearchIndexRow.searchText must be lowercased for consistent keyword matching.");
  }
  return problems;
}

export function computeTotalPages(total: number, pageSize: number): number {
  return pageSize <= 0 ? 0 : Math.ceil(total / pageSize);
}
