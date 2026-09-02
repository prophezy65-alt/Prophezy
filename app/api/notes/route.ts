import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { generateAndSaveNotes, listNotesForUser } from "@/lib/notes/services/notes.service";
import { SupabaseNotesRepository } from "@/lib/notes/services/notes.repository.supabase";
import { AIValidationError, AIRequestError, AITimeoutError, AISafetyBlockedError } from "@/lib/ai/utils/errors";
import { generateNoteRequestSchema, listNotesQuerySchema } from "@/lib/validations/notes";
import type { Notes } from "@/lib/notes/models/types";

const repository = new SupabaseNotesRepository();

function serializeNotes(notes: Notes) {
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
    summary: notes.summary,
    wordCount: notes.wordCount,
    createdAt: notes.createdAt,
    updatedAt: notes.updatedAt,
  };
}

/** GET /api/notes — list the current user's notes, optionally filtered/searched. */
export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);

  const parsed = listNotesQuerySchema.safeParse({
    folderId: searchParams.get("folderId") ?? undefined,
    unfiled: searchParams.get("unfiled") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    pinnedOnly: searchParams.get("pinnedOnly") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters", issues: parsed.error.issues }, { status: 400 });
  }

  const { folderId, unfiled, tag, pinnedOnly, q } = parsed.data;

  try {
    // Full-text search uses the real search_notes() Postgres function
    // (0007_notes.sql's tsvector + trigger) rather than an ilike scan —
    // ranked, indexed, and RLS-scoped for free.
    if (q && q.trim()) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("search_notes", { p_query: q.trim(), p_limit: 30 });
      if (error) throw error;

      const hydrated = await Promise.all(
        (data ?? []).map((row) => repository.getById(row.id))
      );
      const notes = hydrated.filter((n): n is Notes => n !== null && n.userId === user.id);
      return NextResponse.json({ notes: notes.map(serializeNotes) });
    }

    const notes = await listNotesForUser(
      user.id,
      {
        folderId: unfiled ? null : folderId,
        tag,
        pinnedOnly,
      },
      { repository }
    );

    return NextResponse.json({ notes: notes.map(serializeNotes) });
  } catch (err) {
    console.error("GET /api/notes failed", err);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }
}

/** POST /api/notes — generate a new AI note and persist it. */
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = generateNoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const input = parsed.data;

  try {
    const result = await generateAndSaveNotes(
      {
        userId: user.id,
        noteType: input.noteType,
        source: {
          kind: input.sourceKind,
          text: input.sourceText,
          title: input.sourceTitle,
          uploadId: input.uploadId,
          origin: input.uploadId ? { module: "upload", refId: input.uploadId } : { module: "manual" },
        },
        learningMode: input.learningMode,
        outputStyle: input.outputStyle,
        focusTopic: input.focusTopic,
        lengthHint: input.lengthHint,
        folderId: input.folderId ?? null,
        tags: input.tags ?? [],
      },
      { repository }
    );

    return NextResponse.json(
      { note: { ...serializeNotes(result.notes), contentMd: result.markdown } },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AIValidationError) {
      const looksTruncated = /expected a json object/i.test(err.message);
      return NextResponse.json(
        {
          error: looksTruncated
            ? "The AI's response was too long and got cut off. Try a shorter source, a more focused note type (e.g. \"Short notes\" or \"Key points\"), or a narrower focus topic."
            : err.message,
          issues: err.issues,
        },
        { status: 422 }
      );
    }
    if (err instanceof AISafetyBlockedError) {
      return NextResponse.json({ error: "This content couldn't be processed for safety reasons." }, { status: 422 });
    }
    if (err instanceof AITimeoutError) {
      return NextResponse.json({ error: "Note generation timed out. Try a shorter source or try again." }, { status: 504 });
    }
    if (err instanceof AIRequestError) {
      return NextResponse.json({ error: "The AI service failed to generate notes. Please try again." }, { status: 502 });
    }
    console.error("POST /api/notes failed", err);
    return NextResponse.json({ error: "Failed to generate notes" }, { status: 500 });
  }
}
