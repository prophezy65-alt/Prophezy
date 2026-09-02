import { flashcardsService, hintService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { requireOwnedCard } from "@/lib/flashcards/http/ownership";
import { ok, fail } from "@/lib/flashcards/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/flashcards/cards/:cardId/hint — generates (if not already set) and returns a hint. */
export async function POST(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  try {
    const user = await requireApiUser();
    const { cardId } = await context.params;
    const card = await requireOwnedCard(cardId, user.id);

    if (card.hint) return ok({ hint: card.hint, generated: false });

    const deck = await flashcardsService.getDeck(card.deckId);
    const hint = await hintService.generateAndSaveHint(cardId, user.id, deck?.learningMode ?? "intermediate");

    return ok({ hint, generated: true });
  } catch (error) {
    return fail(error);
  }
}
