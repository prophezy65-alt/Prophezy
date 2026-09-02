import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { regenerateSummary } from "@/lib/notes/services/notes.service";
import { SupabaseNotesRepository } from "@/lib/notes/services/notes.repository.supabase";
import { AIRequestError, AITimeoutError, AISafetyBlockedError, AIValidationError } from "@/lib/ai/utils/errors";

const repository = new SupabaseNotesRepository();

/** POST /api/notes/:id/summary — regenerate a note's summary from its current content. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const updated = await regenerateSummary(id, user.id, { repository });
    if (!updated) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    return NextResponse.json({ summary: updated.summary });
  } catch (err) {
    if (err instanceof AIValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof AISafetyBlockedError) {
      return NextResponse.json({ error: "This content couldn't be processed for safety reasons." }, { status: 422 });
    }
    if (err instanceof AITimeoutError) {
      return NextResponse.json({ error: "Summary generation timed out. Please try again." }, { status: 504 });
    }
    if (err instanceof AIRequestError) {
      return NextResponse.json({ error: "The AI service failed to generate a summary." }, { status: 502 });
    }
    console.error(`POST /api/notes/${id}/summary failed`, err);
    return NextResponse.json({ error: "Failed to regenerate summary" }, { status: 500 });
  }
}
