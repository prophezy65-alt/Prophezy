import type { NextRequest } from "next/server";
import { flashcardsService, analyticsService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";
import { NotFoundError } from "@/lib/flashcards/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/flashcards/decks/:deckId/sessions — start a study session. */
export async function POST(_request: NextRequest, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const session = await analyticsService.startSession(deckId, user.id);
    return ok(session, 201);
  } catch (error) {
    return fail(error);
  }
}

/** PATCH /api/flashcards/decks/:deckId/sessions — body: { sessionId, cardsSeen, cardsCorrect } — end a study session. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const body = await request.json();
    if (typeof body.sessionId !== "string") {
      return fail(new Error("Missing sessionId."));
    }

    await analyticsService.endSession(body.sessionId, Number(body.cardsSeen ?? 0), Number(body.cardsCorrect ?? 0));
    return ok({ ended: true });
  } catch (error) {
    return fail(error);
  }
}
