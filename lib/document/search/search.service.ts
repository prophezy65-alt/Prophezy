/**
 * lib/document/search/search.service.ts
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { embed } from "@/lib/ai/config/client";
import { DocumentError } from "../errors/document-errors";
import { validationService } from "../services/validation.service";
import type { SearchResult } from "../models/analysis.model";

export const searchService = {
  async search(rawInput: unknown): Promise<SearchResult[]> {
    const input = validationService.validateSearchRequest(rawInput);

    switch (input.mode) {
      case "semantic":
        return this.semanticSearch(input.query, input.documentId, input.limit ?? 20, input.userId);
      case "keyword":
      case "full_text":
        return this.keywordSearch(input.query, input.documentId, input.limit ?? 20);
      case "hybrid":
        return this.hybridSearch(input.query, input.documentId, input.limit ?? 20, input.userId);
      case "metadata":
        return this.metadataSearch(input.query, input.userId, input.limit ?? 20);
      case "section":
        return this.sectionSearch(input.query, input.documentId, input.limit ?? 20);
      case "page":
        return this.pageSearch(input.query, input.documentId, input.limit ?? 20);
      case "topic":
        return this.topicSearch(input.query, input.documentId, input.limit ?? 20);
      default:
        throw new DocumentError("Unsupported search mode.", "SEARCH_MODE_UNSUPPORTED", { mode: input.mode });
    }
  },

  async semanticSearch(query: string, documentId: string | undefined, limit: number, userId: string): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    const vector = await embed(query);

    // Same pgvector RPC pattern documented in the Flashcards Engine's
    // search.service.ts — Supabase's JS client can't express `<=>`
    // ordering directly, so this needs a `match_document_chunks` SQL
    // function (see the migration file's comment for the exact SQL).
    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: JSON.stringify(vector),
      match_document_id: documentId ?? undefined,
      match_limit: limit,
    });

    if (error) throw new DocumentError("Semantic search failed.", "SEARCH_ERROR", { cause: error.message });

    return ((data as any[]) ?? []).map((row, i) => ({
      documentId: row.document_id,
      chunkId: row.id,
      pageIndex: row.start_page_index ?? null,
      sectionId: null,
      snippet: row.text.slice(0, 300),
      score: Number((1 - i / Math.max(1, (data as any[]).length)).toFixed(3)),
      matchType: "semantic" as const,
    }));
  },

  /**
   * FIX: previously `ilike("text", `%${query}%`)` on the RAW, unmodified
   * user message — for a natural-language question like "what is this
   * paper about", that requires a chunk to contain that exact phrase
   * verbatim, in that exact word order, which essentially never happens
   * in real paper text. Every keyword search on a real question returned
   * zero results, always, regardless of whether the paper had relevant
   * content. This now splits the query into significant words (3+
   * characters, common stopwords dropped) and matches a chunk if it
   * contains ANY of them — a real, if basic, keyword match instead of an
   * exact-phrase match. hybridSearch's RRF merge with semantic results
   * still ranks multi-word/more-specific matches higher naturally.
   */
  buildKeywordTerms(query: string): string[] {
    const stopwords = new Set([
      "the", "and", "for", "are", "but", "not", "you", "all", "can", "has",
      "was", "were", "this", "that", "with", "from", "what", "how", "why",
      "does", "did", "about", "into", "than", "then", "them", "they",
    ]);
    return Array.from(
      new Set(
        query
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 3 && !stopwords.has(w))
      )
    );
  },

  async keywordSearch(query: string, documentId: string | undefined, limit: number): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    const terms = this.buildKeywordTerms(query);
    // No significant words left after filtering (e.g. a very short/all-
    // stopword query) — nothing meaningful to match on, return empty
    // rather than an unfiltered `ilike '%%'` that would match everything.
    if (terms.length === 0) return [];

    let builder = supabase
      .from("document_chunks")
      .select()
      .or(terms.map((t) => `text.ilike.%${t.replace(/[%,()]/g, (c) => `\\${c}`)}%`).join(","))
      .limit(limit);
    if (documentId) builder = builder.eq("document_id", documentId);

    const { data, error } = await builder;
    if (error) throw new DocumentError("Keyword search failed.", "SEARCH_ERROR", { cause: error.message });

    return ((data as any[]) ?? []).map((row) => ({
      documentId: row.document_id,
      chunkId: row.id,
      pageIndex: row.start_page_index ?? null,
      sectionId: null,
      snippet: row.text.slice(0, 300),
      score: 1,
      matchType: "keyword" as const,
    }));
  },

  async hybridSearch(query: string, documentId: string | undefined, limit: number, userId: string): Promise<SearchResult[]> {
    const [semantic, keyword] = await Promise.all([
      this.semanticSearch(query, documentId, limit, userId).catch((err) => {
        // FIX: previously swallowed completely silently — if
        // match_document_chunks doesn't exist, or embed() fails, semantic
        // search has been contributing zero results with no trace
        // anywhere. Now at least logged, so a fully-empty RAG result
        // shows a clear reason in the logs instead of just... nothing.
        // eslint-disable-next-line no-console
        console.warn("[search.service] semanticSearch failed, continuing with keyword-only:", err instanceof Error ? err.message : err);
        return [] as SearchResult[];
      }),
      this.keywordSearch(query, documentId, limit),
    ]);

    const merged = new Map<string, SearchResult>();
    // Reciprocal-rank fusion: combine ranks from both lists rather than
    // raw scores, which aren't on the same scale between modes.
    [semantic, keyword].forEach((list) => {
      list.forEach((r, rank) => {
        const key = r.chunkId ?? `${r.documentId}_${r.pageIndex}`;
        const rrf = 1 / (60 + rank);
        const existing = merged.get(key);
        if (existing) {
          existing.score += rrf;
        } else {
          merged.set(key, { ...r, matchType: "hybrid", score: rrf });
        }
      });
    });

    return Array.from(merged.values()).sort((a, b) => b.score - a.score).slice(0, limit);
  },

  async metadataSearch(query: string, userId: string, limit: number): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("documents")
      .select()
      .eq("user_id", userId)
      .or(`filename.ilike.%${query}%,metadata->>title.ilike.%${query}%`)
      .limit(limit);

    if (error) throw new DocumentError("Metadata search failed.", "SEARCH_ERROR", { cause: error.message });

    return ((data as any[]) ?? []).map((row) => ({
      documentId: row.id,
      chunkId: null,
      pageIndex: null,
      sectionId: null,
      snippet: row.filename,
      score: 1,
      matchType: "metadata" as const,
    }));
  },

  async sectionSearch(query: string, documentId: string | undefined, limit: number): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    let builder = supabase.from("document_search_index").select().eq("kind", "section").ilike("text", `%${query}%`).limit(limit);
    if (documentId) builder = builder.eq("document_id", documentId);

    const { data, error } = await builder;
    if (error) throw new DocumentError("Section search failed.", "SEARCH_ERROR", { cause: error.message });

    return ((data as any[]) ?? []).map((row) => ({
      documentId: row.document_id,
      chunkId: null,
      pageIndex: row.page_index ?? null,
      sectionId: row.ref_id ?? null,
      snippet: row.text.slice(0, 300),
      score: 1,
      matchType: "section" as const,
    }));
  },

  async pageSearch(query: string, documentId: string | undefined, limit: number): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    let builder = supabase.from("document_search_index").select().eq("kind", "page").ilike("text", `%${query}%`).limit(limit);
    if (documentId) builder = builder.eq("document_id", documentId);

    const { data, error } = await builder;
    if (error) throw new DocumentError("Page search failed.", "SEARCH_ERROR", { cause: error.message });

    return ((data as any[]) ?? []).map((row) => ({
      documentId: row.document_id,
      chunkId: null,
      pageIndex: row.page_index ?? null,
      sectionId: null,
      snippet: row.text.slice(0, 300),
      score: 1,
      matchType: "page" as const,
    }));
  },

  async topicSearch(query: string, documentId: string | undefined, limit: number): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    let builder = supabase.from("document_search_index").select().eq("kind", "topic").ilike("text", `%${query}%`).limit(limit);
    if (documentId) builder = builder.eq("document_id", documentId);

    const { data, error } = await builder;
    if (error) throw new DocumentError("Topic search failed.", "SEARCH_ERROR", { cause: error.message });

    return ((data as any[]) ?? []).map((row) => ({
      documentId: row.document_id,
      chunkId: null,
      pageIndex: row.page_index ?? null,
      sectionId: null,
      snippet: row.text.slice(0, 300),
      score: 1,
      matchType: "topic" as const,
    }));
  },
};
