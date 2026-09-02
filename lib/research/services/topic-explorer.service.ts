/**
 * lib/research/services/topic-explorer.service.ts
 *
 * ============================================================================
 * REPLACES the old Topic Explorer entirely.
 * ============================================================================
 * The previous implementation (the pre-existing app/api/research/topic)
 * called runResearch() — a Gemini call that wrote a prose "overview" of the
 * topic from the model's own training knowledge, with no real papers
 * involved at all, and optionally saved that generated essay INTO
 * research_papers as if it were a paper (title = the topic string, no
 * authors/abstract/source). That's exactly the fake-data pattern the
 * product spec prohibits, and it's why Topic Explorer was consuming Gemini
 * quota for something that should never have touched an LLM.
 *
 * This version does the whole thing in Postgres against
 * `research_synced_papers` (populated by scripts/sync-research-papers.ts):
 *   1. Expand the topic into a widened term set via
 *      lib/research/utils/topic-synonyms.ts (deterministic synonym list —
 *      see that file for why "Retrieval Augmented Generation" needs this).
 *   2. Rank matches with Postgres's built-in `websearch_to_tsquery` mode
 *      (exposed directly by supabase-js's `.textSearch(..., { type:
 *      "websearch" })` — no custom SQL function needed) against the
 *      generated `search_text` tsvector (0041): title weighted highest,
 *      then topics/categories, then abstract, then authors.
 *   3. Return real papers plus a topic-chip breakdown computed from the
 *      same matched rows' real `topics` column — never a separate guess.
 *
 * Zero Gemini calls. Zero credit cost — this is discovery/browsing, and the
 * product spec is explicit that browsing costs 0 credits regardless of how
 * it's implemented.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Paper } from "../models/paper.types";
import { mapSyncedRowToPaper, type SyncedPaperRow } from "../providers/db-synced/map-synced-row";
import { expandTopicTerms } from "../utils/topic-synonyms";
import { ResearchValidationError, ResearchError } from "../utils/errors";
import { researchLogger } from "../utils/logger";

export class TopicExplorerError extends ResearchError {
  constructor(message: string, cause?: unknown) {
    super(message, "TOPIC_EXPLORER_ERROR", cause);
  }
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
// How many matching rows' `topics` arrays to pull (topics column only —
// small payload) when tallying chip counts. A topic broad enough to match
// more than this is already too broad for exact chip counts to matter much
// — counts are reported honestly as approximate once the match set exceeds
// this, never silently presented as exact totals.
const CHIP_SAMPLE_SIZE = 2000;

export interface TopicSearchQuery {
  topic: string;
  limit?: number;
  offset?: number;
  /** Restrict to one derived topic chip (e.g. "Computer Vision") on top of the text match. */
  topicFilter?: string;
}

export interface TopicChipCount {
  label: string;
  count: number;
}

export interface TopicSearchResult {
  topic: string;
  expandedTerms: string[];
  papers: Paper[];
  total: number;
  chips: TopicChipCount[];
  chipsApproximate: boolean;
  tookMs: number;
}

function validate(input: Partial<TopicSearchQuery>): TopicSearchQuery {
  if (!input.topic || !input.topic.trim()) {
    throw new ResearchValidationError("A topic is required.", ["topic"]);
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT)) {
    throw new ResearchValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}.`, ["limit"]);
  }
  if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
    throw new ResearchValidationError("offset must be a non-negative integer.", ["offset"]);
  }
  return {
    topic: input.topic.trim(),
    limit: input.limit ?? DEFAULT_LIMIT,
    offset: input.offset ?? 0,
    topicFilter: input.topicFilter?.trim() || undefined,
  };
}

/** websearch_to_tsquery understands `OR`/quoted phrases natively, so the
 *  expanded term list becomes a single websearch-syntax string — multi-word
 *  terms quoted so "dense retrieval" matches as a phrase, not
 *  "dense" OR "retrieval" independently. */
function buildWebsearchInput(terms: string[]): string {
  return terms.map((t) => (t.includes(" ") ? `"${t.replace(/"/g, "")}"` : t)).join(" OR ");
}

const SEARCH_COLUMNS =
  "source, source_id, title, abstract, authors, venue, published_date, doi, arxiv_id, landing_url, pdf_url, html_url, categories, topics, citation_count";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** `.textSearch(..., { type: "websearch" })` compiles server-side to
 *  `<column> @@ websearch_to_tsquery('english', input)` — the standard
 *  supabase-js API for this, no custom SQL function required. Factored out
 *  since both the results query and the chip-count query filter on it. */
function applySearchTextMatch<
  B extends { textSearch(column: string, query: string, opts: { type: "websearch"; config: string }): B },
>(builder: B, websearchInput: string): B {
  return builder.textSearch("search_text", websearchInput, { type: "websearch", config: "english" });
}

export async function searchTopics(rawQuery: Partial<TopicSearchQuery>): Promise<TopicSearchResult> {
  const query = validate(rawQuery);
  const startedAt = Date.now();
  const expandedTerms = expandTopicTerms(query.topic);
  const websearchInput = buildWebsearchInput(expandedTerms);

  const supabase: SupabaseClient = await createClient();

  let selectBuilder = applySearchTextMatch(
    supabase.from("research_synced_papers").select(SEARCH_COLUMNS, { count: "exact" }),
    websearchInput
  );
  if (query.topicFilter) selectBuilder = selectBuilder.contains("topics", [query.topicFilter]);

  const { data, error, count } = await selectBuilder
    .order("published_date", { ascending: false, nullsFirst: false })
    .range(query.offset!, query.offset! + query.limit! - 1)
    .returns<SyncedPaperRow[]>();

  if (error) {
    throw new TopicExplorerError("Topic search failed.", error.message);
  }

  const papers = (data ?? []).map(mapSyncedRowToPaper);

  const chipBuilder = applySearchTextMatch(
    supabase.from("research_synced_papers").select("topics").limit(CHIP_SAMPLE_SIZE),
    websearchInput
  );
  const { data: chipRows, error: chipError } = await chipBuilder.returns<{ topics: string[] }[]>();

  let chips: TopicChipCount[] = [];
  if (chipError) {
    researchLogger.warn("topic-explorer.chip_counts_failed", { error: chipError.message });
  } else {
    const tally = new Map<string, number>();
    for (const row of chipRows ?? []) {
      for (const label of row.topics ?? []) tally.set(label, (tally.get(label) ?? 0) + 1);
    }
    chips = Array.from(tally.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  const tookMs = Date.now() - startedAt;
  researchLogger.info("topic-explorer.search.done", {
    topic: query.topic,
    resultCount: papers.length,
    total: count ?? papers.length,
    tookMs,
  });

  return {
    topic: query.topic,
    expandedTerms,
    papers,
    total: count ?? papers.length,
    chips,
    chipsApproximate: (count ?? 0) > CHIP_SAMPLE_SIZE,
    tookMs,
  };
}
