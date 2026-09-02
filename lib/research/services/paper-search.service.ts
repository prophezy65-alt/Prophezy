/**
 * lib/research/services/paper-search.service.ts
 *
 * The single entry point API routes call for paper search. Fans a
 * validated query out to every provider that supports its `kind`,
 * runs them concurrently, tolerates individual provider failures
 * (Promise.allSettled — one dead provider must never sink the
 * whole search), deduplicates the merged result set, and returns
 * both the merged list and the untouched per-provider results for
 * transparency/debugging.
 *
 * This file has zero knowledge of Next.js, HTTP, or Gemini — it's a
 * pure orchestration layer over PaperSearchProvider, so it's trivial
 * to unit test and safe to call from any API route.
 */

import type {
  AggregatedSearchResult,
  Paper,
  PaperSearchQuery,
  ProviderSearchResult,
} from '../models/paper.types';
import { getProviders } from '../providers/provider.registry';
import { validatePaperSearchQuery } from '../validation/search-query.validation';
import { AllProvidersFailedError } from '../utils/errors';
import { researchLogger } from '../utils/logger';

function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A paper's dedup key prefers strong identifiers (DOI, arXiv id)
 * and falls back to a normalized title. Two providers returning the
 * "same" paper with different sourceIds still collapse to one
 * record as long as either identifier matches or the titles are
 * identical once normalized.
 */
function dedupKey(paper: Paper): string {
  if (paper.identifiers.doi) return `doi:${paper.identifiers.doi.toLowerCase()}`;
  if (paper.identifiers.arxivId) return `arxiv:${paper.identifiers.arxivId}`;
  if (paper.identifiers.pmid) return `pmid:${paper.identifiers.pmid}`;
  return `title:${normalizeTitleKey(paper.title)}`;
}

/** When two records collapse, keep the one with richer metadata (more citation data, longer abstract). */
function mergeDuplicate(existing: Paper, incoming: Paper): Paper {
  const richerAbstract =
    (incoming.abstract?.length ?? 0) > (existing.abstract?.length ?? 0)
      ? incoming.abstract
      : existing.abstract;

  return {
    ...existing,
    abstract: richerAbstract,
    identifiers: { ...incoming.identifiers, ...existing.identifiers },
    links: { ...incoming.links, ...existing.links },
    metrics: {
      citationCount: existing.metrics.citationCount ?? incoming.metrics.citationCount,
      influentialCitationCount:
        existing.metrics.influentialCitationCount ?? incoming.metrics.influentialCitationCount,
      referenceCount: existing.metrics.referenceCount ?? incoming.metrics.referenceCount,
    },
    fieldsOfStudy: existing.fieldsOfStudy?.length
      ? existing.fieldsOfStudy
      : incoming.fieldsOfStudy,
  };
}

function deduplicate(papers: Paper[]): Paper[] {
  const seen = new Map<string, Paper>();
  for (const paper of papers) {
    const key = dedupKey(paper);
    const existing = seen.get(key);
    seen.set(key, existing ? mergeDuplicate(existing, paper) : paper);
  }
  return Array.from(seen.values());
}

export async function searchPapers(
  rawQuery: Partial<PaperSearchQuery>,
): Promise<AggregatedSearchResult> {
  const query = validatePaperSearchQuery(rawQuery);
  const startedAt = Date.now();

  const candidateProviders = getProviders(query.sources).filter((p) =>
    p.supports(query.kind),
  );

  if (candidateProviders.length === 0) {
    throw new AllProvidersFailedError({
      _: `no registered provider supports query kind "${query.kind}"`,
    });
  }

  researchLogger.info('paper-search.start', {
    kind: query.kind,
    query: query.query,
    providers: candidateProviders.map((p) => p.source),
  });

  const settled = await Promise.allSettled(
    candidateProviders.map((provider) => provider.search(query)),
  );

  const perSource: ProviderSearchResult[] = [];
  const failures: Record<string, string> = {};

  settled.forEach((result, index) => {
    const provider = candidateProviders[index]!;
    if (result.status === 'fulfilled') {
      perSource.push(result.value);
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures[provider.source] = message;
      researchLogger.error('paper-search.provider-failed', {
        provider: provider.source,
        error: message,
      });
    }
  });

  if (perSource.length === 0) {
    throw new AllProvidersFailedError(failures);
  }

  const merged = deduplicate(perSource.flatMap((r) => r.papers));

  const tookMs = Date.now() - startedAt;
  researchLogger.info('paper-search.done', {
    resultCount: merged.length,
    providersSucceeded: perSource.length,
    providersFailed: Object.keys(failures).length,
    tookMs,
  });

  return {
    query,
    papers: merged,
    perSource,
    tookMs,
  };
}
