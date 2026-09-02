/**
 * lib/research/providers/db-synced/db-synced.provider.ts
 *
 * Reads from `research_synced_papers` (migration 0040/0041) — populated by
 * the GitHub Actions background sync (scripts/sync-research-papers.ts),
 * NOT fetched live. Implementing the same PaperSearchProvider interface
 * every live source uses means the existing Search Papers UI, the existing
 * /api/research/search route, and the existing dedup pass in
 * paper-search.service.ts all need ZERO changes — this just becomes one
 * more provider the registry fans a query out to, exactly like ArxivProvider.
 *
 * This stays on plain ILIKE (not the search_text tsvector added in 0041) —
 * Search Papers' existing UX is "find this specific paper", where a
 * substring match is the more predictable behavior; the new ranked
 * full-text search lives in topic-explorer.service.ts instead, where
 * "most relevant to this broad topic" ranking is actually the point.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaperSearchQuery, PaperSource, ProviderSearchResult } from "../../models/paper.types";
import type { PaperSearchProvider } from "../provider.interface";
import { researchLogger } from "../../utils/logger";
import { mapSyncedRowToPaper, type SyncedPaperRow } from "./map-synced-row";

const SOURCE: PaperSource = "arxiv";
// Author search over a text[] column needs a real substring match (unnest +
// ilike), not the exact-element `contains()` Postgres offers out of the
// box — rather than ship an inaccurate approximation, this provider simply
// doesn't claim to support 'author' queries; the live ArxivProvider (which
// already supports it correctly) still runs.
const SUPPORTED_KINDS: PaperSearchQuery["kind"][] = ["keyword", "topic"];

const SYNCED_PAPER_COLUMNS =
  "source, source_id, title, abstract, authors, venue, published_date, doi, arxiv_id, landing_url, pdf_url, html_url, categories, topics, citation_count";

export class SyncedArxivProvider implements PaperSearchProvider {
  readonly source = SOURCE;

  supports(kind: PaperSearchQuery["kind"]): boolean {
    return SUPPORTED_KINDS.includes(kind);
  }

  async search(query: PaperSearchQuery): Promise<ProviderSearchResult> {
    const term = query.query.trim();
    const limit = Math.min(query.limit ?? 20, 50);

    try {
      const supabase = await createClient();
      const escaped = term.replace(/[%,()]/g, (c) => `\\${c}`);

      let builder = supabase
        .from("research_synced_papers")
        .select(SYNCED_PAPER_COLUMNS)
        .or(`title.ilike.%${escaped}%,abstract.ilike.%${escaped}%`)
        .order("published_date", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (query.fromYear) builder = builder.gte("published_date", `${query.fromYear}-01-01`);
      if (query.toYear) builder = builder.lte("published_date", `${query.toYear}-12-31`);

      const { data, error } = await builder.returns<SyncedPaperRow[]>();

      if (error) {
        researchLogger.warn("synced-arxiv.search.failed", { error: error.message });
        return { source: SOURCE, papers: [], warnings: [`synced index unavailable: ${error.message}`] };
      }

      return { source: SOURCE, papers: (data ?? []).map(mapSyncedRowToPaper) };
    } catch (err) {
      researchLogger.warn("synced-arxiv.search.failed", { error: err instanceof Error ? err.message : String(err) });
      return { source: SOURCE, papers: [], warnings: ["synced index unavailable"] };
    }
  }
}
