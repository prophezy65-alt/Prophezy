/**
 * lib/flashcards/services/search.service.ts
 *
 * Six search modes as specced: semantic, keyword, topic, concept, formula,
 * tag. Semantic search uses `embed()` from `lib/ai/config/client.ts` (listed
 * in your README alongside generate()/streamGenerate()) plus pgvector's
 * `<=>` cosine-distance operator on `flashcards.embedding` (additive, 0021).
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { embed } from "@/lib/ai/config/client";
import { AIValidationError } from "@/lib/ai/utils/errors";
import { validationService } from "../validation/validation.service";
import { rowToFlashcard, type Flashcard, type FlashcardRow } from "../models/flashcard.model";
import { conceptService } from "./concept.service";

export interface SearchResult {
  card: Flashcard;
  score: number; // 0..1, higher is better; for keyword modes this is a match-quality heuristic
}

export const searchService = {
  async search(rawInput: unknown): Promise<SearchResult[]> {
    const input = validationService.validateSearchRequest(rawInput);

    switch (input.mode) {
      case "semantic":
        return this.semanticSearch(input.query, input.deckId, input.limit ?? 20, input.userId);
      case "keyword":
        return this.keywordSearch(input.query, input.deckId, input.limit ?? 20);
      case "tag":
        return this.tagSearch(input.query, input.deckId, input.limit ?? 20);
      case "topic":
      case "concept":
        return this.conceptSearch(input.query, input.deckId, input.limit ?? 20);
      case "formula":
        return this.formulaSearch(input.query, input.deckId, input.limit ?? 20);
      default:
        throw new AIValidationError("Unsupported search mode.", { mode: input.mode });
    }
  },

  async semanticSearch(query: string, deckId: string | undefined, limit: number, userId: string): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    const embedding = await embed(query);

    // pgvector cosine-distance ordering via an RPC function is the standard
    // pattern (Supabase doesn't support `<=>` directly through the JS query
    // builder) — this assumes a `match_flashcards` SQL function; add it
    // alongside 0021 if it doesn't already exist:
    //   create function match_flashcards(query_embedding vector(768), match_deck_id uuid, match_limit int)
    //   returns setof flashcards language sql stable as $$
    //     select * from flashcards
    //     where (match_deck_id is null or deck_id = match_deck_id)
    //       and embedding is not null
    //     order by embedding <=> query_embedding
    //     limit match_limit;
    //   $$;
    const { data, error } = await supabase.rpc("match_flashcards", {
      query_embedding: JSON.stringify(embedding),
      match_deck_id: deckId ?? undefined,
      match_limit: limit,
    });

    if (error) throw new AIValidationError("Semantic search failed.", { cause: error.message });

    return ((data as FlashcardRow[]) ?? []).map((row, i) => ({
      card: rowToFlashcard(row),
      score: Number((1 - i / Math.max(1, (data as unknown[]).length)).toFixed(3)),
    }));
  },

  async keywordSearch(query: string, deckId: string | undefined, limit: number): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    let builder = supabase
      .from("flashcards")
      .select()
      .or(`front.ilike.%${query}%,back.ilike.%${query}%,explanation.ilike.%${query}%`)
      .limit(limit);

    if (deckId) builder = builder.eq("deck_id", deckId);

    const { data, error } = await builder;
    if (error) throw new AIValidationError("Keyword search failed.", { cause: error.message });

    return ((data as FlashcardRow[]) ?? []).map((row) => ({ card: rowToFlashcard(row), score: 1 }));
  },

  async tagSearch(tag: string, deckId: string | undefined, limit: number): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    let builder = supabase.from("flashcards").select().contains("tags", [tag]).limit(limit);
    if (deckId) builder = builder.eq("deck_id", deckId);

    const { data, error } = await builder;
    if (error) throw new AIValidationError("Tag search failed.", { cause: error.message });

    return ((data as FlashcardRow[]) ?? []).map((row) => ({ card: rowToFlashcard(row), score: 1 }));
  },

  async conceptSearch(name: string, deckId: string | undefined, limit: number): Promise<SearchResult[]> {
    if (!deckId) {
      throw new AIValidationError("Concept/topic search requires a deckId.", {});
    }
    const concepts = await conceptService.listConceptsForDeck(deckId);
    const match = concepts.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!match || match.cardIds.length === 0) return [];

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("flashcards").select().in("id", match.cardIds).limit(limit);
    if (error) throw new AIValidationError("Concept search failed.", { cause: error.message });

    return ((data as FlashcardRow[]) ?? []).map((row) => ({ card: rowToFlashcard(row), score: match.weight }));
  },

  async formulaSearch(query: string, deckId: string | undefined, limit: number): Promise<SearchResult[]> {
    const supabase = await getSupabaseServerClient();
    let builder = supabase
      .from("flashcards")
      .select()
      .eq("card_type", "formula")
      .or(`front.ilike.%${query}%,back.ilike.%${query}%`)
      .limit(limit);
    if (deckId) builder = builder.eq("deck_id", deckId);

    const { data, error } = await builder;
    if (error) throw new AIValidationError("Formula search failed.", { cause: error.message });

    return ((data as FlashcardRow[]) ?? []).map((row) => ({ card: rowToFlashcard(row), score: 1 }));
  },
};
