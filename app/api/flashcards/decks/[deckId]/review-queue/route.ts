import { flashcardsService, schedulerService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";
import { NotFoundError } from "@/lib/flashcards/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/flashcards/decks/:deckId/review-queue — today's due/learning/new cards, review-mode ready. */
export async function GET(request: Request, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const cards = await flashcardsService.listCardsForDeck(deckId);

    const url = new URL(request.url);
    const newCardLimit = url.searchParams.get("newCardLimit");
    const maxCards = url.searchParams.get("maxCards");

    const queue = schedulerService.buildReviewQueue(cards, {
      newCardLimit: newCardLimit ? Number(newCardLimit) : undefined,
      maxCards: maxCards ? Number(maxCards) : undefined,
    });

    // The queue schedules reference cards by id only — attach the full card
    // (front/back/hint/etc.) so the review UI doesn't need a second round trip.
    const cardsById = new Map(cards.map((c) => [c.id, c]));
    const withCards = {
      due: queue.due.map((s) => ({ schedule: s, card: cardsById.get(s.flashcardId) })),
      learning: queue.learning.map((s) => ({ schedule: s, card: cardsById.get(s.flashcardId) })),
      newCards: queue.newCards.map((s) => ({ schedule: s, card: cardsById.get(s.flashcardId) })),
      overdueCount: queue.overdueCount,
    };

    return ok(withCards);
  } catch (error) {
    return fail(error);
  }
}
