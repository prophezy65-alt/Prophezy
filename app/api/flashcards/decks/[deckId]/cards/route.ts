import type { NextRequest } from "next/server";
import { flashcardsService, draftFlashcardSchema, toDraftFlashcard } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";
import { NotFoundError } from "@/lib/flashcards/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/flashcards/decks/:deckId/cards */
export async function GET(_request: Request, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const cards = await flashcardsService.listCardsForDeck(deckId);
    return ok(cards);
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/flashcards/decks/:deckId/cards — manually add a single card (not AI-generated). */
export async function POST(request: NextRequest, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const body = await request.json();
    const parsed = draftFlashcardSchema.parse({ confidence: 1, metadata: {}, ...body });
    const draft = toDraftFlashcard(parsed);

    const card = await flashcardsService.createCard({ deckId, draft });
    await flashcardsService.updateCardCount(deckId, deck.cardCount + 1);

    return ok(card, 201);
  } catch (error) {
    return fail(error);
  }
}
