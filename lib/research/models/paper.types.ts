/**
 * lib/research/models/paper.types.ts
 *
 * Canonical, provider-agnostic representation of a research paper.
 * Every provider (arXiv, CrossRef, Semantic Scholar, OpenAlex, PubMed, ...)
 * normalizes its raw response into this shape. Nothing downstream
 * (services, ranking, citation, embeddings) should ever see a
 * provider-specific payload.
 */

export type PaperSource =
  | 'arxiv'
  | 'crossref'
  | 'semantic_scholar'
  | 'openalex'
  | 'pubmed';

export interface PaperAuthor {
  name: string;
  affiliation?: string;
  orcid?: string;
}

export interface PaperIdentifiers {
  doi?: string;
  arxivId?: string;
  pmid?: string;
  semanticScholarId?: string;
  openAlexId?: string;
  isbn?: string;
}

export interface PaperLinks {
  landingPage?: string;
  pdf?: string;
  html?: string;
}

export interface PaperMetrics {
  citationCount?: number;
  influentialCitationCount?: number;
  referenceCount?: number;
}

/**
 * The normalized paper record. `raw` retains the untouched provider
 * payload for debugging/audit only — no downstream code may read
 * from it; everything it needs must already be mapped onto typed
 * fields above.
 */
export interface Paper {
  id: string; // stable internal id: `${source}:${sourceId}`
  source: PaperSource;
  sourceId: string;
  title: string;
  abstract?: string;
  authors: PaperAuthor[];
  venue?: string;
  publishedDate?: string; // ISO 8601 (YYYY-MM-DD or YYYY-MM or YYYY)
  identifiers: PaperIdentifiers;
  links: PaperLinks;
  metrics: PaperMetrics;
  fieldsOfStudy?: string[];
  fetchedAt: string; // ISO timestamp of normalization
  raw?: unknown;
}

export type SearchKind =
  | 'keyword'
  | 'topic'
  | 'author'
  | 'doi'
  | 'institution'
  | 'conference'
  | 'journal';

export interface PaperSearchQuery {
  kind: SearchKind;
  query: string;
  limit?: number; // default applied by service, capped per provider
  offset?: number;
  fromYear?: number;
  toYear?: number;
  sources?: PaperSource[]; // restrict to a subset of providers; default = all registered
}

export interface ProviderSearchResult {
  source: PaperSource;
  papers: Paper[];
  totalAvailable?: number; // provider-reported total, if it exposes one
  warnings?: string[]; // e.g. "query truncated", "rate limited, partial results"
}

export interface AggregatedSearchResult {
  query: PaperSearchQuery;
  papers: Paper[]; // deduplicated + merged across providers
  perSource: ProviderSearchResult[]; // untouched per-provider results, for transparency/debugging
  tookMs: number;
}
