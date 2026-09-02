/**
 * lib/research/providers/arxiv/arxiv.provider.ts
 *
 * Implements PaperSearchProvider for arxiv.org's public search API
 * (https://export.arxiv.org/api/query). No API key required.
 *
 * arXiv only really supports keyword/topic/author-style queries —
 * it has no institution/conference/journal facets and no reliable
 * DOI search, so `supports()` reports that honestly and the
 * aggregating service will route those query kinds to providers
 * that do support them (CrossRef, OpenAlex, etc.).
 */

import type {
  Paper,
  PaperSearchQuery,
  PaperSource,
  ProviderSearchResult,
} from '../../models/paper.types';
import type { PaperSearchProvider } from '../provider.interface';
import { parseArxivFeed } from './arxiv.parser';
import { withRetry } from '../../utils/retry';
import { researchLogger } from '../../utils/logger';
import {
  ProviderRateLimitError,
  ProviderRequestError,
  ProviderTimeoutError,
} from '../../utils/errors';
import type { ArxivRawEntry } from './arxiv.types';

const ARXIV_API_BASE = 'https://export.arxiv.org/api/query';
const SOURCE: PaperSource = 'arxiv';
const REQUEST_TIMEOUT_MS = 10_000;
const SUPPORTED_KINDS: PaperSearchQuery['kind'][] = ['keyword', 'topic', 'author'];

function buildSearchExpression(query: PaperSearchQuery): string {
  const escaped = query.query.replace(/"/g, '\\"');
  switch (query.kind) {
    case 'author':
      return `au:"${escaped}"`;
    case 'topic':
      return `all:"${escaped}"`;
    case 'keyword':
    default:
      return `all:${escaped}`;
  }
}

function normalizeEntry(entry: ArxivRawEntry): Paper {
  const arxivId = entry.id.split('/abs/')[1] ?? entry.id;
  const pdfLink = entry.links.find((l) => l.title === 'pdf' || l.type === 'application/pdf');
  const landingLink = entry.links.find((l) => l.rel === 'alternate') ?? entry.links[0];

  return {
    id: `arxiv:${arxivId}`,
    source: SOURCE,
    sourceId: arxivId,
    title: entry.title,
    abstract: entry.summary,
    authors: entry.authors.map((a) => ({ name: a.name })),
    venue: entry.primaryCategory,
    publishedDate: entry.published?.slice(0, 10),
    identifiers: {
      arxivId,
      doi: entry.doi,
    },
    links: {
      landingPage: landingLink?.href,
      pdf: pdfLink?.href,
    },
    metrics: {},
    fieldsOfStudy: entry.categories,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
      throw new ProviderRateLimitError(SOURCE, retryAfterMs);
    }
    if (!response.ok) {
      throw new ProviderRequestError(
        SOURCE,
        `Unexpected HTTP status ${response.status}`,
        response.status,
      );
    }
    return response;
  } catch (err) {
    if (err instanceof ProviderRateLimitError || err instanceof ProviderRequestError) {
      throw err;
    }
    if ((err as Error)?.name === 'AbortError') {
      throw new ProviderTimeoutError(SOURCE, timeoutMs);
    }
    throw new ProviderRequestError(SOURCE, 'Network request failed', undefined, err);
  } finally {
    clearTimeout(timer);
  }
}

export class ArxivProvider implements PaperSearchProvider {
  readonly source = SOURCE;

  supports(kind: PaperSearchQuery['kind']): boolean {
    return SUPPORTED_KINDS.includes(kind);
  }

  async search(query: PaperSearchQuery): Promise<ProviderSearchResult> {
    const searchExpression = buildSearchExpression(query);
    const params = new URLSearchParams({
      search_query: searchExpression,
      start: String(query.offset ?? 0),
      max_results: String(query.limit ?? 20),
      sortBy: 'relevance',
      sortOrder: 'descending',
    });
    const url = `${ARXIV_API_BASE}?${params.toString()}`;

    researchLogger.info('arxiv.search.start', { query: query.query, kind: query.kind, url });

    const xml = await withRetry(
      async () => {
        const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
        return response.text();
      },
      {
        onRetry: (attempt, err, delayMs) =>
          researchLogger.warn('arxiv.search.retry', {
            attempt,
            delayMs,
            error: err instanceof Error ? err.message : String(err),
          }),
      },
    );

    const { entries, totalResults } = parseArxivFeed(xml);
    const papers = entries.map(normalizeEntry);
    // arXiv date filtering isn't part of the query syntax used here; apply it client-side.
    const filtered = papers.filter((p) => {
      if (!p.publishedDate) return true;
      const year = Number(p.publishedDate.slice(0, 4));
      if (query.fromYear && year < query.fromYear) return false;
      if (query.toYear && year > query.toYear) return false;
      return true;
    });

    researchLogger.info('arxiv.search.done', { returned: filtered.length, totalResults });

    return {
      source: SOURCE,
      papers: filtered,
      totalAvailable: totalResults,
    };
  }
}
