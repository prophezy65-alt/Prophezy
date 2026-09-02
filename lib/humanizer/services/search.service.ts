// lib/humanizer/services/search.service.ts
//
// Three search modes over humanizer_history:
//  - "keyword": Postgres full-text / ILIKE search — always available, zero
//    extra infra.
//  - "semantic": pgvector cosine-similarity search against an `embedding`
//    column on humanizer_history (added in migrations/0002_humanizer_analytics.sql).
//    Requires the embedding to have been computed at save time via the AI
//    Core Engine's embed() function (per README.md: "client.ts — Low-level
//    Gemini REST wrapper: generate(), streamGenerate(), embed()").
//  - "history": a plain reverse-chronological listing, optionally filtered
//    by style/domain — not really a "search" so much as a browse, but kept
//    under the same entry point since the frontend's search UI treats it as
//    one of the three tabs.

import { createAdminClient as getSupabaseAdminClient } from "@/lib/supabase/admin";
import { embed } from "@/lib/ai/config/client";
import type { SearchMode, SearchResult, RewriteStyle, ContentDomain } from "../models/types";
import { logger } from "./_logger";

export interface SearchOptions {
  userId: string;
  mode: SearchMode;
  query?: string; // required for "semantic" and "keyword"
  styleFilter?: RewriteStyle;
  domainFilter?: ContentDomain;
  limit?: number;
}

export async function searchHumanizerHistory(options: SearchOptions): Promise<SearchResult[]> {
  switch (options.mode) {
    case "semantic":
      return semanticSearch(options);
    case "keyword":
      return keywordSearch(options);
    case "history":
      return historyBrowse(options);
  }
}

async function semanticSearch(options: SearchOptions): Promise<SearchResult[]> {
  if (!options.query || options.query.trim().length === 0) {
    throw new Error("`query` is required for semantic search");
  }

  const supabase = getSupabaseAdminClient();

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embed(options.query);
  } catch (err) {
    logger.warn("humanizer.search.embed_failed", { error: String(err) });
    // Degrade to keyword search rather than failing the request outright.
    return keywordSearch(options);
  }

  const { data, error } = await supabase.rpc("match_humanizer_history", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_user_id: options.userId,
    match_count: options.limit ?? 20,
  });

  if (error) {
    logger.error("humanizer.search.semantic_failed", { error: String(error) });
    throw new Error(`Semantic search failed: ${error.message}`);
  }

  return (data ?? []).map((row: SemanticMatchRow) => ({
    rewriteId: row.rewrite_id,
    snippet: row.rewritten_text.slice(0, 240),
    score: row.similarity,
    createdAt: row.created_at,
  }));
}

interface SemanticMatchRow {
  rewrite_id: string;
  rewritten_text: string;
  similarity: number;
  created_at: string;
}

async function keywordSearch(options: SearchOptions): Promise<SearchResult[]> {
  if (!options.query || options.query.trim().length === 0) {
    throw new Error("`query` is required for keyword search");
  }

  const supabase = getSupabaseAdminClient();
  let queryBuilder = supabase
    .from("humanizer_history")
    .select("rewrite_id, rewritten_text, created_at")
    .eq("user_id", options.userId)
    .textSearch("rewritten_text", sanitizeTsQuery(options.query), { type: "websearch" })
    .limit(options.limit ?? 20);

  const { data, error } = await queryBuilder;
  if (error) {
    logger.error("humanizer.search.keyword_failed", { error: String(error) });
    throw new Error(`Keyword search failed: ${error.message}`);
  }

  return (data ?? []).map((row: { rewrite_id: string; rewritten_text: string; created_at: string }) => ({
    rewriteId: row.rewrite_id,
    snippet: row.rewritten_text.slice(0, 240),
    score: 1, // Postgres text search doesn't return a normalized 0-1 score by default
    createdAt: row.created_at,
  }));
}

async function historyBrowse(options: SearchOptions): Promise<SearchResult[]> {
  const supabase = getSupabaseAdminClient();
  let queryBuilder = supabase
    .from("humanizer_history")
    .select("rewrite_id, rewritten_text, created_at, style, domain")
    .eq("user_id", options.userId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 20);

  if (options.styleFilter) queryBuilder = queryBuilder.eq("style", options.styleFilter);
  if (options.domainFilter) queryBuilder = queryBuilder.eq("domain", options.domainFilter);

  const { data, error } = await queryBuilder;
  if (error) {
    logger.error("humanizer.search.history_failed", { error: String(error) });
    throw new Error(`History browse failed: ${error.message}`);
  }

  return (data ?? []).map((row: { rewrite_id: string; rewritten_text: string; created_at: string }) => ({
    rewriteId: row.rewrite_id,
    snippet: row.rewritten_text.slice(0, 240),
    score: 1,
    createdAt: row.created_at,
  }));
}

function sanitizeTsQuery(query: string): string {
  // websearch_to_tsquery handles most raw user input safely, but strip
  // control characters defensively before it reaches Postgres.
  return query.replace(/[\u0000-\u001F]/g, "").slice(0, 500);
}
