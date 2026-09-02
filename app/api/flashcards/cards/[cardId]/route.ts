import type { NextRequest } from "next/server";
import { flashcardsService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { requireOwnedCard } from "@/lib/flashcards/http/ownership";
import { ok, fail } from "@/lib/flashcards/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/flashcards/cards/:cardId */
export async function PATCH(request: NextRequest, context: { params: Promise<{ cardId: string }> }) {
  try {
    const user = await requireApiUser();
    const { cardId } = await context.params;
    await requireOwnedCard(cardId, user.id);

    const body = await request.json();
    const updated = await flashcardsService.updateCard({ id: cardId, ...body });
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/flashcards/cards/:cardId */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ cardId: string }> }) {
  try {
    const user = await requireApiUser();
    const { cardId } = await context.params;
    const card = await requireOwnedCard(cardId, user.id);

    await flashcardsService.deleteCard(cardId);

    const deck = await flashcardsService.getDeck(card.deckId);
    if (deck) await flashcardsService.updateCardCount(card.deckId, Math.max(0, deck.cardCount - 1));

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
