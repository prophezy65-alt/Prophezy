/**
 * lib/notes/services/search.service.ts
 *
 * Search over a user's generated notes. Two search modes hit the database
 * directly (semantic via pgvector, keyword via ilike joined through
 * `generations` for title/user_id — see the real 0007_notes.sql schema);
 * the rest (topic/concept/definition/formula search) work over
 * already-generated structured output in memory, since that only exists at
 * generation time and isn't worth a dedicated DB query shape for.
 *
 * NOTE: for actual production search over PERSISTED notes, prefer the real
 * `search_notes(p_query, p_limit)` Postgres function (full-text, ranked,
 * RLS-scoped) used directly in app/api/notes/route.ts — this file's
 * keywordSearch/searchWithinNotes remain here for the in-memory/structured
 * use cases the RPC can't cover (e.g. searching within a single generation's
 * topics right after it's generated, before it's even saved).
 *
 * Written against `MinimalSupabaseClient` (see notes.repository.supabase.ts)
 * so it has the same "swap in your real typed client" story.
 */

import type { createClient } from "@/lib/supabase/server";
import { embedText } from "../providers/embedding.provider";
import type { NoteGenerationOutput, NotesOutput, SearchResult } from "../models/types";

/**
 * The real Supabase server client type (previously imported from
 * notes.repository.supabase.ts, which used to take an injected client of
 * this shape — it now calls the real `createClient()` directly per method
 * instead of dependency injection, so that export no longer exists there).
 * Defined here instead since these two functions are the only remaining
 * callers that take a client as a parameter.
 */
export type MinimalSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function isProseNotes(content: NoteGenerationOutput): content is NotesOutput {
  return "topics" in content && "keyPoints" in content;
}

/**
 * Semantic search over a user's UPLOADED SOURCE DOCUMENTS (via the real
 * Document Intelligence Engine's `document_chunks`/`match_document_chunks`,
 * 0022_document_intelligence.sql) — not over notes themselves. The real
 * `notes` table has no `embedding` column (see 0007_notes.sql +
 * 0035_notes_workspace.sql), so there is nothing to run pgvector search
 * against on notes directly; this searches the material a note was
 * generated FROM instead, which is the closest real, schema-backed
 * approximation of "semantic search my notes" available today.
 *
 * `match_document_id` narrows to one source document; omit it to search
 * across everything the RLS-scoped caller can see.
 */
export async function semanticSearchSourceDocuments(
  client: MinimalSupabaseClient,
  query: string,
  options: { documentId?: string; limit?: number } = {}
): Promise<{ documentId: string; chunkId: string; snippet: string; similarity: number }[]> {
  const { vector } = await embedText(query);
  const queryEmbedding = `[${vector.join(",")}]`;

  const { data, error } = await client.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_document_id: options.documentId,
    match_limit: options.limit ?? 10,
  });

  if (error) throw new Error(`semanticSearchSourceDocuments failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    documentId: row.document_id,
    chunkId: row.id,
    snippet: row.text.slice(0, 240),
    similarity: row.similarity,
  }));
}

/**
 * Keyword search over note titles + content, via ilike. Superseded by the
 * real `search_notes()` Postgres function (0007_notes.sql's `search_vector`
 * tsvector + trigger, used directly in app/api/notes/route.ts) for actual
 * production search — that's ranked, indexed, and RLS-scoped for free.
 * This function is kept schema-correct (joins through `generations` for
 * title/user_id, since `notes` itself has neither) as a fallback for
 * callers that specifically need ilike substring matching rather than
 * ts_query word matching.
 */
export async function keywordSearch(
  client: MinimalSupabaseClient,
  userId: string,
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  const { data, error } = await client
    .from("notes")
    .select("id, content_md, generations!inner(id, title, user_id)")
    .eq("generations.user_id", userId)
    .ilike("generations.title", `%${query}%`)
    .limit(limit);

  if (error) throw new Error(`keywordSearch failed: ${error.message}`);

  return ((data ?? []) as Array<{
    id: string;
    content_md: string;
    generations: { id: string; title: string; user_id: string };
  }>).map((row) => ({
    notesId: row.id,
    title: row.generations.title,
    snippet: row.content_md.slice(0, 240),
    score: 1,
    matchType: "keyword" as const,
  }));
}

function snippetAround(text: string, query: string, radius = 100): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  return text.slice(start, start + radius * 2);
}

/**
 * In-memory search across a set of already-generated (not yet persisted, or
 * held alongside their generation output) notes, matched against a specific
 * structured field type. Takes explicit `{ notesId, title, content }` tuples
 * rather than persisted `Notes` objects, since structured topics/
 * definitions/formulas only exist at generation time — once saved, only
 * `contentMd` (flattened markdown) survives.
 */
export function searchWithinNotes(
  notesList: { notesId: string; title: string; content: NoteGenerationOutput }[],
  query: string,
  matchType: Extract<SearchResult["matchType"], "topic" | "concept" | "definition" | "formula">
): SearchResult[] {
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const notes of notesList) {
    if (!isProseNotes(notes.content)) continue;
    const content = notes.content;

    if (matchType === "topic" || matchType === "concept") {
      for (const topic of content.topics) {
        const haystack = `${topic.title} ${topic.summary}`.toLowerCase();
        if (haystack.includes(q)) {
          results.push({
            notesId: notes.notesId,
            title: notes.title,
            snippet: snippetAround(topic.summary, query),
            score: topic.title.toLowerCase().includes(q) ? 2 : 1,
            matchType,
          });
        }
      }
    }

    if (matchType === "definition") {
      for (const def of content.definitions) {
        if (def.term.toLowerCase().includes(q) || def.definition.toLowerCase().includes(q)) {
          results.push({
            notesId: notes.notesId,
            title: notes.title,
            snippet: `${def.term}: ${snippetAround(def.definition, query)}`,
            score: def.term.toLowerCase().includes(q) ? 2 : 1,
            matchType,
          });
        }
      }
    }

    if (matchType === "formula") {
      for (const formula of content.formulas) {
        if (
          formula.name.toLowerCase().includes(q) ||
          formula.expression.toLowerCase().includes(q)
        ) {
          results.push({
            notesId: notes.notesId,
            title: notes.title,
            snippet: `${formula.name}: ${formula.expression}`,
            score: formula.name.toLowerCase().includes(q) ? 2 : 1,
            matchType,
          });
        }
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
