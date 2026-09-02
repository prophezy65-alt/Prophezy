import type { NextRequest } from "next/server";
import { reviewService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { requireOwnedCard } from "@/lib/flashcards/http/ownership";
import { ok, fail } from "@/lib/flashcards/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/flashcards/cards/:cardId/review — body: { rating: "easy"|"medium"|"hard"|"forgot", responseTimeMs? } */
export async function POST(request: NextRequest, context: { params: Promise<{ cardId: string }> }) {
  try {
    const user = await requireApiUser();
    const { cardId } = await context.params;
    await requireOwnedCard(cardId, user.id);

    const body = await request.json();
    const result = await reviewService.submitReview({
      flashcardId: cardId,
      userId: user.id,
      rating: body.rating,
      responseTimeMs: body.responseTimeMs,
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
