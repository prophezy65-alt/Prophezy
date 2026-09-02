import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getNotes, deleteNotes } from "@/lib/notes/services/notes.service";
import { SupabaseNotesRepository } from "@/lib/notes/services/notes.repository.supabase";
import { patchNoteSchema } from "@/lib/validations/notes";
import type { Notes } from "@/lib/notes/models/types";

const repository = new SupabaseNotesRepository();

function serializeNote(notes: Notes) {
  return {
    id: notes.id,
    title: notes.title,
    noteType: notes.noteType,
    learningMode: notes.learningMode ?? null,
    outputStyle: notes.outputStyle ?? null,
    folderId: notes.folderId,
    tags: notes.tags,
    isPinned: notes.isPinned,
    status: notes.status,
    contentMd: notes.contentMd,
    summary: notes.summary,
    wordCount: notes.wordCount,
    createdAt: notes.createdAt,
    updatedAt: notes.updatedAt,
  };
}

/** GET /api/notes/:id */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const notes = await getNotes(id, user.id, { repository });
    if (!notes) {
      console.warn(`GET /api/notes/${id}: no note found for user ${user.id}`);
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    const payload = serializeNote(notes);
    console.log(`GET /api/notes/${id}: returning note "${payload.title}", contentMd length=${payload.contentMd?.length ?? 0}`);
    return NextResponse.json({ note: payload });
  } catch (err) {
    console.error(`GET /api/notes/${id} failed`, err);
    return NextResponse.json({ error: "Failed to load note" }, { status: 500 });
  }
}

/**
 * PATCH /api/notes/:id — auto-save (contentMd) and/or metadata edits
 * (title/folderId/tags/isPinned), any subset in one request.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const existing = await getNotes(id, user.id, { repository });
    if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const updated = await repository.update(id, parsed.data);
    return NextResponse.json({ note: serializeNote(updated) });
  } catch (err) {
    console.error(`PATCH /api/notes/${id} failed`, err);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}

/** DELETE /api/notes/:id */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  try {
    await deleteNotes(id, user.id, { repository });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/notes/${id} failed`, err);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
