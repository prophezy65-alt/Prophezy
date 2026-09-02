import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { listNoteVersions } from "@/lib/notes/services/notes.service";
import { SupabaseNotesRepository } from "@/lib/notes/services/notes.repository.supabase";

const repository = new SupabaseNotesRepository();

/** GET /api/notes/:id/versions — version history, most recent first. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const versions = await listNoteVersions(id, user.id, { repository });
    return NextResponse.json({
      versions: versions.map((v) => ({
        id: v.id,
        wordCount: v.wordCount,
        createdAt: v.createdAt,
        preview: v.contentMd.slice(0, 200),
      })),
    });
  } catch (err) {
    console.error(`GET /api/notes/${id}/versions failed`, err);
    return NextResponse.json({ error: "Failed to load version history" }, { status: 500 });
  }
}
