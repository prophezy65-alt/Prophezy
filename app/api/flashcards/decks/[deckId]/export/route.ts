import { flashcardsService, exportService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { fail } from "@/lib/flashcards/http/response";
import { NotFoundError } from "@/lib/flashcards/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/flashcards/decks/:deckId/export?format=markdown|json|csv|txt|html|anki */
export async function GET(request: Request, context: { params: Promise<{ deckId: string }> }) {
  try {
    const user = await requireApiUser();
    const { deckId } = await context.params;

    const deck = await flashcardsService.getDeckForUser(deckId, user.id);
    if (!deck) throw new NotFoundError("Deck not found.");

    const format = new URL(request.url).searchParams.get("format") ?? "json";
    const result = await exportService.exportDeck({ deckId, format });

    const body = typeof result.content === "string" ? result.content : new Uint8Array(result.content);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
