/**
 * lib/flashcards/http/ownership.ts
 *
 * Cards, like decks, have no user_id column — ownership flows through
 * card.deckId -> flashcard_decks.generation_id -> generations.user_id.
 * Every card-level route (update/delete/review/hint/mnemonic) needs this
 * same two-hop check, so it's factored out once here rather than repeated
 * five times.
 */

import { flashcardsService } from "@/lib/flashcards";
import { NotFoundError } from "./errors";
import type { Flashcard } from "@/lib/flashcards/models/flashcard.model";

export async function requireOwnedCard(cardId: string, userId: string): Promise<Flashcard> {
  const card = await flashcardsService.getCard(cardId);
  if (!card) throw new NotFoundError("Flashcard not found.");

  const deck = await flashcardsService.getDeckForUser(card.deckId, userId);
  if (!deck) throw new NotFoundError("Flashcard not found.");

  return card;
}
