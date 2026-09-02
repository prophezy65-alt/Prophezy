import { createClient } from "@/lib/supabase/server";
import { flashcardsService } from "@/lib/flashcards";
import { generatorService } from "@/lib/flashcards/services/generator.service";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/flashcards/decks - every deck belonging to the current user.
 * Returns the array directly (not wrapped in { decks: [...] }) since
 * useDecks() in useFlashcardsApi.ts calls apiFetch<FlashcardDeck[]>(...)
 * and expects `data` to be the array itself.
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    const decks = await flashcardsService.listDecksForUser(user.id);
    return ok(decks);
  } catch (error) {
    return fail(error);
  }
}

interface GenerateDeckRequestBody {
  title?: string;
  sourceType: string;
  sourceRef?: string;
  text?: string;
  learningMode?: string;
  cardTypes?: string[];
  targetCardCount?: number;
}

/**
 * POST /api/flashcards/decks - generate a new deck via the AI Core.
 *
 * Every AI generation in this codebase is backed by a `generations` row
 * (kind/title/user_id required per its real Insert type) that downstream
 * tables FK into - flashcard_decks.generation_id is a required FK, same
 * pattern as lib/notes/services/notes.repository.supabase.ts's save().
 *
 * We create the `generations` row first (status "processing") so
 * generatorService.generateDeck has a generationId to attach the deck to,
 * then flip it to "ready" on success or "failed" (with the real error
 * message) on failure - mirroring the notes repository's rollback style,
 * except here we keep the generation row (with status "failed") rather
 * than deleting it, so a failed attempt stays visible/debuggable instead
 * of silently vanishing.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const user = await requireApiUser();
    const body = (await request.json()) as GenerateDeckRequestBody;

    if (!body.sourceType || (!body.text || body.text.trim().length === 0)) {
      return fail(new Error("sourceType and non-empty text are required."));
    }

    const { data: generation, error: genError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        kind: "flashcards",
        title: body.title?.trim() || "Untitled deck",
        status: "processing",
      })
      .select()
      .single();

    if (genError || !generation) {
      return fail(new Error(`Failed to create generation record: ${genError?.message}`));
    }

    try {
      const result = await generatorService.generateDeck({
        generationId: generation.id,
        userId: user.id,
        title: body.title,
        sourceType: body.sourceType,
        sourceRef: body.sourceRef,
        learningMode: body.learningMode,
        cardTypes: body.cardTypes as never,
        targetCardCount: body.targetCardCount,
        text: body.text,
      });

      await supabase
        .from("generations")
        .update({ status: "ready", title: result.deck.title, updated_at: new Date().toISOString() })
        .eq("id", generation.id);

      return ok({
        deck: result.deck,
        cards: result.cards,
        droppedDuplicateCount: result.droppedDuplicateCount,
      });
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : String(generationError);
      await supabase
        .from("generations")
        .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
        .eq("id", generation.id);
      throw generationError;
    }
  } catch (error) {
    return fail(error);
  }
}
