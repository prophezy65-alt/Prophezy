/**
 * lib/research/services/paper.service.ts
 *
 * CRUD over `research_papers` plus the shared helper every AI feature in
 * this module needs: pulling a paper's extracted text back out of the
 * Document Intelligence Engine's chunk store. Papers saved from external
 * search (no upload) have no chunks — those fall back to the abstract.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Paper } from "../models/paper.types";
import type { ResearchPaperInsert, ResearchPaperRow } from "../models/db.types";
import { ResearchError } from "../utils/errors";
import { researchLogger } from "../utils/logger";

export class PaperNotFoundError extends ResearchError {
  constructor(paperId: string) {
    super(`Research paper ${paperId} not found.`, "PAPER_NOT_FOUND");
  }
}

export class PaperPersistenceError extends ResearchError {
  constructor(message: string, cause?: unknown) {
    super(message, "PAPER_PERSISTENCE_ERROR", cause);
  }
}

export interface ListPapersOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * `research_papers` gains `source` / `source_id` / `pdf_url` / `categories`
 * in migration 0039_research_papers_source_metadata.sql (see that file for
 * why). Until `lib/supabase/types.ts` is regenerated
 * (`npx supabase gen types typescript ...`) against the migrated schema,
 * the generated `ResearchPaperInsert` type won't know about them yet — this
 * local extension keeps the insert calls below fully typed in the meantime
 * without touching the generated file. Safe to delete once types are
 * regenerated and these fields show up in `ResearchPaperInsert` itself.
 */
type ResearchPaperInsertExt = ResearchPaperInsert & {
  source?: string | null;
  source_id?: string | null;
  pdf_url?: string | null;
  categories?: string[];
};

/** Lists the signed-in user's papers, newest first, optionally full-text filtered by title/authors. */
export async function listPapers(userId: string, opts: ListPapersOptions = {}): Promise<ResearchPaperRow[]> {
  const supabase = await createClient();
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  let query = supabase
    .from("research_papers")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.search?.trim()) {
    query = query.ilike("title", `%${opts.search.trim()}%`);
  }

  const { data, error } = await query.returns<ResearchPaperRow[]>();
  if (error) throw new PaperPersistenceError("Failed to list research papers.", error.message);
  return data ?? [];
}

export async function getPaper(userId: string, paperId: string): Promise<ResearchPaperRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_papers")
    .select()
    .eq("id", paperId)
    .eq("user_id", userId)
    .maybeSingle<ResearchPaperRow>();

  if (error) throw new PaperPersistenceError("Failed to fetch research paper.", error.message);
  if (!data) throw new PaperNotFoundError(paperId);
  return data;
}

export async function deletePaper(userId: string, paperId: string): Promise<void> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("research_papers")
    .delete({ count: "exact" })
    .eq("id", paperId)
    .eq("user_id", userId);

  if (error) throw new PaperPersistenceError("Failed to delete research paper.", error.message);
  if (!count) throw new PaperNotFoundError(paperId);
}

/**
 * Saves a paper found via external search (arXiv, etc — see
 * paper-search.service.ts) into the user's library, with no upload/OCR
 * involved. `getPaperSourceText` falls back to the abstract for these.
 *
 * ============================================================================
 * DEDUP FIX (paired with 0039_research_papers_source_metadata.sql)
 * ============================================================================
 * Previously this always ran a plain INSERT, so clicking "Save" twice on the
 * same search result (or a search returning the same paper again on a later
 * page/session) created a second identical library row — the duplicate-
 * looking cards ("Temporal Change Detection S...", "A Self-Evolving Temporal
 * Retri..." each appearing twice) in the product screenshots. This now
 * checks for an existing (user_id, source, source_id) row first and returns
 * it instead of inserting again, with the DB-level partial unique index as
 * the backstop for the race between two concurrent "Save" clicks.
 */
export async function savePaperFromSearchResult(userId: string, paper: Paper): Promise<ResearchPaperRow> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("research_papers")
    .select()
    .eq("user_id", userId)
    .eq("source", paper.source)
    .eq("source_id", paper.sourceId)
    .maybeSingle<ResearchPaperRow>();

  if (existingError) {
    throw new PaperPersistenceError("Failed to check for an existing copy of this paper.", existingError.message);
  }
  if (existing) {
    researchLogger.info("paper.save_from_search.already_saved", {
      userId,
      paperId: existing.id,
      source: paper.source,
    });
    return existing;
  }

  const insert: ResearchPaperInsertExt = {
    user_id: userId,
    title: paper.title,
    authors: paper.authors.map((a) => a.name),
    source: paper.source,
    source_id: paper.sourceId,
    source_url: paper.links.landingPage ?? paper.links.pdf ?? paper.links.html ?? null,
    pdf_url: paper.links.pdf ?? null,
    abstract: paper.abstract ?? null,
    published_at: paper.publishedDate ?? null,
    categories: paper.fieldsOfStudy ?? [],
  };

  const { data, error } = await supabase.from("research_papers").insert(insert).select().single<ResearchPaperRow>();

  if (error) {
    // 23505 = unique_violation on idx_research_papers_user_source_dedup —
    // a concurrent request (double-click, two open tabs) won the race
    // between our existence check above and this insert. Treat it the same
    // as the fast path instead of surfacing a confusing 500.
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("research_papers")
        .select()
        .eq("user_id", userId)
        .eq("source", paper.source)
        .eq("source_id", paper.sourceId)
        .maybeSingle<ResearchPaperRow>();
      if (raced) return raced;
    }
    throw new PaperPersistenceError("Failed to save paper.", error.message);
  }
  if (!data) throw new PaperPersistenceError("Failed to save paper.");

  researchLogger.info("paper.saved_from_search", { userId, paperId: data.id, source: paper.source });
  return data;
}

/** Persists an AI-generated summary onto a paper the user owns. */
export async function saveSummary(userId: string, paperId: string, summaryMd: string): Promise<ResearchPaperRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_papers")
    .update({ summary_md: summaryMd, updated_at: new Date().toISOString() })
    .eq("id", paperId)
    .eq("user_id", userId)
    .select()
    .single<ResearchPaperRow>();

  if (error || !data) throw new PaperPersistenceError("Failed to save summary.", error?.message);
  return data;
}

const MAX_SUMMARY_SOURCE_CHARS = 60_000; // ~15k tokens — plenty for a full paper, keeps cost bounded
const MAX_CITATION_SOURCE_CHARS = 40_000;

/**
 * Assembles the text an AI call should read for a given paper: the full
 * chunked document text if one was uploaded, otherwise the abstract.
 * `preferTail` pulls from the end of the document instead of the start —
 * used for citation extraction, since reference lists are almost always
 * the last section of a paper.
 */
export async function getPaperSourceText(
  userId: string,
  paperId: string,
  opts: { preferTail?: boolean; maxChars?: number } = {}
): Promise<{ text: string; hasFullText: boolean }> {
  const paper = await getPaper(userId, paperId);
  const maxChars = opts.maxChars ?? MAX_SUMMARY_SOURCE_CHARS;

  if (!paper.document_id) {
    return { text: paper.abstract ?? "", hasFullText: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_chunks")
    .select("chunk_index, text")
    .eq("document_id", paper.document_id)
    .order("chunk_index", { ascending: true })
    .returns<{ chunk_index: number; text: string }[]>();

  if (error) throw new PaperPersistenceError("Failed to load paper text.", error.message);
  if (!data || data.length === 0) {
    return { text: paper.abstract ?? "", hasFullText: false };
  }

  const fullText = data.map((c) => c.text).join("\n\n");
  if (fullText.length <= maxChars) {
    return { text: fullText, hasFullText: true };
  }

  const truncated = opts.preferTail ? fullText.slice(-maxChars) : fullText.slice(0, maxChars);
  return { text: truncated, hasFullText: false };
}

export { MAX_SUMMARY_SOURCE_CHARS, MAX_CITATION_SOURCE_CHARS };
