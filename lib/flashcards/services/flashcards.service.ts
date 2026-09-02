/**
 * lib/flashcards/services/flashcards.service.ts
 *
 * The ONLY file in this module that talks to Supabase directly for deck/card
 * CRUD. Everything else works with the typed `Flashcard`/`FlashcardDeck`
 * models.
 *
 * ASSUMPTION: I don't have your Supabase client wrapper's exact export name
 * (not shared). This assumes a standard `getSupabaseServerClient()` factory
 * at `@/lib/supabase/server`, matching the `lib/supabase/` folder visible in
 * your file tree. If your real export is named differently (e.g.
 * `createServerClient`, `supabaseAdmin`), update the single import below —
 * every method here goes through the `db()` helper, so it's a one-line fix.
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, Database } from "@/lib/supabase/types";
import { AIValidationError } from "@/lib/ai/utils/errors";
import {
  rowToFlashcard,
  type Flashcard,
  type FlashcardRow,
  type CreateFlashcardInput,
  type UpdateFlashcardInput,
} from "../models/flashcard.model";
import { rowToDeck, type FlashcardDeck, type FlashcardDeckRow } from "../models/deck.model";

async function db() {
  return getSupabaseServerClient();
}

export const flashcardsService = {
  // --- Decks ---------------------------------------------------------------

  async createDeck(input: {
    generationId: string;
    title: string;
    learningMode: string;
    sourceType?: string | null;
    sourceRef?: string | null;
  }): Promise<FlashcardDeck> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("flashcard_decks")
      .insert({
        generation_id: input.generationId,
        title: input.title,
        learning_mode: input.learningMode,
        source_type: input.sourceType ?? null,
        source_ref: input.sourceRef ?? null,
      })
      .select()
      .single<FlashcardDeckRow>();

    if (error || !data) {
      throw new AIValidationError("Failed to create flashcard deck.", { cause: error?.message });
    }
    return rowToDeck(data);
  },

  async getDeck(deckId: string): Promise<FlashcardDeck | null> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("flashcard_decks")
      .select()
      .eq("id", deckId)
      .maybeSingle<FlashcardDeckRow>();

    if (error) throw new AIValidationError("Failed to fetch deck.", { cause: error.message });
    return data ? rowToDeck(data) : null;
  },

  async listDecksForUser(userId: string): Promise<FlashcardDeck[]> {
    const supabase = await db();
    // generations table (existing, reused) links deck -> owning user.
    const { data, error } = await supabase
      .from("flashcard_decks")
      .select("*, generations!inner(user_id)")
      .eq("generations.user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new AIValidationError("Failed to list decks.", { cause: error.message });
    return (data as FlashcardDeckRow[]).map(rowToDeck);
  },

  /**
   * Ownership-checked single-deck lookup — new, additive. getDeck(deckId)
   * above has no user filter (flashcard_decks has no user_id column;
   * ownership flows through generation_id -> generations.user_id, same as
   * listDecksForUser's join), so every API route reading/mutating a
   * specific deck by id needs this instead of getDeck() to avoid an IDOR
   * (any signed-in user fetching any other user's deck by guessing a uuid).
   * Returns null for "doesn't exist" and "exists but isn't yours" alike —
   * routes should treat both as 404, not leak which case it was.
   */
  async getDeckForUser(deckId: string, userId: string): Promise<FlashcardDeck | null> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("flashcard_decks")
      .select("*, generations!inner(user_id)")
      .eq("id", deckId)
      .eq("generations.user_id", userId)
      .maybeSingle();

    if (error) throw new AIValidationError("Failed to fetch deck.", { cause: error.message });
    return data ? rowToDeck(data as FlashcardDeckRow) : null;
  },

  async updateCardCount(deckId: string, cardCount: number): Promise<void> {
    const supabase = await db();
    const { error } = await supabase
      .from("flashcard_decks")
      .update({ card_count: cardCount, updated_at: new Date().toISOString() })
      .eq("id", deckId);
    if (error) throw new AIValidationError("Failed to update deck card count.", { cause: error.message });
  },

  async deleteDeck(deckId: string): Promise<void> {
    const supabase = await db();
    const { error } = await supabase.from("flashcard_decks").delete().eq("id", deckId);
    if (error) throw new AIValidationError("Failed to delete deck.", { cause: error.message });
  },

  // --- Cards -----------------------------------------------------------------

  async createCard(input: CreateFlashcardInput): Promise<Flashcard> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("flashcards")
      .insert({
        deck_id: input.deckId,
        card_type: input.draft.cardType,
        front: input.draft.front,
        back: input.draft.back,
        position: input.position ?? 0,
        tags: input.draft.tags,
        hint: input.draft.hint ?? null,
        mnemonic: input.draft.mnemonic ?? null,
        explanation: input.draft.explanation ?? null,
        difficulty: input.draft.difficulty,
        confidence: input.draft.confidence,
        source_excerpt: input.draft.sourceExcerpt ?? null,
        image_url: input.draft.imageUrl ?? null,
        metadata: (input.draft.metadata ?? {}) as unknown as Json,
      })
      .select()
      .single<FlashcardRow>();

    if (error || !data) {
      throw new AIValidationError("Failed to create flashcard.", { cause: error?.message });
    }
    return rowToFlashcard(data);
  },

  async createCards(deckId: string, drafts: CreateFlashcardInput["draft"][]): Promise<Flashcard[]> {
    const supabase = await db();
    const rows = drafts.map((draft, i) => ({
      deck_id: deckId,
      card_type: draft.cardType,
      front: draft.front,
      back: draft.back,
      position: i,
      tags: draft.tags,
      hint: draft.hint ?? null,
      mnemonic: draft.mnemonic ?? null,
      explanation: draft.explanation ?? null,
      difficulty: draft.difficulty,
      confidence: draft.confidence,
      source_excerpt: draft.sourceExcerpt ?? null,
      image_url: draft.imageUrl ?? null,
      metadata: (draft.metadata ?? {}) as unknown as Json,
    }));

    const { data, error } = await supabase.from("flashcards").insert(rows).select();
    if (error || !data) {
      throw new AIValidationError("Failed to bulk-create flashcards.", { cause: error?.message });
    }
    return (data as FlashcardRow[]).map(rowToFlashcard);
  },

  async listCardsForDeck(deckId: string): Promise<Flashcard[]> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("flashcards")
      .select()
      .eq("deck_id", deckId)
      .order("position", { ascending: true });

    if (error) throw new AIValidationError("Failed to list flashcards.", { cause: error.message });
    return (data as FlashcardRow[]).map(rowToFlashcard);
  },

  async getCard(cardId: string): Promise<Flashcard | null> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("flashcards")
      .select()
      .eq("id", cardId)
      .maybeSingle<FlashcardRow>();

    if (error) throw new AIValidationError("Failed to fetch flashcard.", { cause: error.message });
    return data ? rowToFlashcard(data) : null;
  },

  async updateCard(input: UpdateFlashcardInput): Promise<Flashcard> {
    const supabase = await db();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.front !== undefined) patch.front = input.front;
    if (input.back !== undefined) patch.back = input.back;
    if (input.tags !== undefined) patch.tags = input.tags;
    if (input.hint !== undefined) patch.hint = input.hint;
    if (input.mnemonic !== undefined) patch.mnemonic = input.mnemonic;
    if (input.explanation !== undefined) patch.explanation = input.explanation;
    if (input.difficulty !== undefined) patch.difficulty = input.difficulty;

    const { data, error } = await supabase
      .from("flashcards")
      .update(patch as unknown as Database["public"]["Tables"]["flashcards"]["Update"])
      .eq("id", input.id)
      .select()
      .single<FlashcardRow>();

    if (error || !data) {
      throw new AIValidationError("Failed to update flashcard.", { cause: error?.message });
    }
    return rowToFlashcard(data);
  },

  async updateSchedule(
    cardId: string,
    schedule: { easeFactor: number; intervalDays: number; repetitions: number; dueAt: string }
  ): Promise<Flashcard> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("flashcards")
      .update({
        ease_factor: schedule.easeFactor,
        interval_days: schedule.intervalDays,
        repetitions: schedule.repetitions,
        due_at: schedule.dueAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
      .select()
      .single<FlashcardRow>();

    if (error || !data) {
      throw new AIValidationError("Failed to update flashcard schedule.", { cause: error?.message });
    }
    return rowToFlashcard(data);
  },

  async markDuplicate(cardId: string, duplicateOfId: string): Promise<void> {
    const supabase = await db();
    const { error } = await supabase
      .from("flashcards")
      .update({ duplicate_of: duplicateOfId })
      .eq("id", cardId);
    if (error) throw new AIValidationError("Failed to mark flashcard as duplicate.", { cause: error.message });
  },

  async deleteCard(cardId: string): Promise<void> {
    const supabase = await db();
    const { error } = await supabase.from("flashcards").delete().eq("id", cardId);
    if (error) throw new AIValidationError("Failed to delete flashcard.", { cause: error.message });
  },
};
