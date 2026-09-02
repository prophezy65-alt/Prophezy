import { flashcardsService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";
import { NotFoundError } from "@/lib/flashcards/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/flashcards/decks/:deckId - deck + its cards. */
export async function GET(_request: Request, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const cards = await flashcardsService.listCardsForDeck(deckId);
    return ok({ deck, cards });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/flashcards/decks/:deckId */
export async function DELETE(_request: Request, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    await flashcardsService.deleteDeck(deckId);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
