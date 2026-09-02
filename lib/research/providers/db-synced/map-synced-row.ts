/**
 * lib/research/providers/db-synced/map-synced-row.ts
 *
 * Single mapping from a `research_synced_papers` row to the canonical
 * `Paper` shape — used by both db-synced.provider.ts (Search Papers) and
 * topic-explorer.service.ts (Topic Explorer), so the two discovery
 * surfaces never drift into representing a synced paper differently.
 */
import type { Paper, PaperSource } from "../../models/paper.types";

export interface SyncedPaperRow {
  source: string;
  source_id: string;
  title: string;
  abstract: string | null;
  authors: string[];
  venue: string | null;
  published_date: string | null;
  doi: string | null;
  arxiv_id: string | null;
  landing_url: string | null;
  pdf_url: string | null;
  html_url: string | null;
  categories: string[];
  topics: string[];
  citation_count: number | null;
}

export function mapSyncedRowToPaper(row: SyncedPaperRow): Paper {
  return {
    id: `${row.source}:${row.source_id}`,
    source: row.source as PaperSource,
    sourceId: row.source_id,
    title: row.title,
    abstract: row.abstract ?? undefined,
    authors: (row.authors ?? []).map((name) => ({ name })),
    venue: row.venue ?? undefined,
    publishedDate: row.published_date ?? undefined,
    identifiers: {
      doi: row.doi ?? undefined,
      arxivId: row.arxiv_id ?? undefined,
    },
    links: {
      landingPage: row.landing_url ?? undefined,
      pdf: row.pdf_url ?? undefined,
      html: row.html_url ?? undefined,
    },
    metrics: { citationCount: row.citation_count ?? undefined },
    fieldsOfStudy: row.categories ?? [],
    fetchedAt: new Date().toISOString(),
  };
}
