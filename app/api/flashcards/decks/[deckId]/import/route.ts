import type { NextRequest } from "next/server";
import { flashcardsService } from "@/lib/flashcards";
import { importService, type ImportFormat } from "@/lib/flashcards/import/import.service";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";
import { NotFoundError } from "@/lib/flashcards/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_FORMATS: ImportFormat[] = ["csv", "anki", "json"];

/** POST /api/flashcards/decks/:deckId/import — body: { format: "csv"|"anki"|"json", content: string } */
export async function POST(request: NextRequest, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const body = await request.json();
    const format = body.format as ImportFormat;
    if (!VALID_FORMATS.includes(format)) {
      return fail(new Error(`Invalid import format. Must be one of: ${VALID_FORMATS.join(", ")}`));
    }
    if (typeof body.content !== "string" || !body.content.trim()) {
      return fail(new Error("Missing import content."));
    }

    const result = await importService.importCards(deckId, format, body.content);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
