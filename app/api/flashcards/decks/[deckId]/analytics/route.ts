import { flashcardsService, analyticsService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";
import { NotFoundError } from "@/lib/flashcards/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/flashcards/decks/:deckId/analytics */
export async function GET(_request: Request, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const analytics = await analyticsService.getDeckAnalytics(deckId);
    return ok(analytics);
  } catch (error) {
    return fail(error);
  }
}
