import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { restoreNoteVersion } from "@/lib/notes/services/notes.service";
import { SupabaseNotesRepository } from "@/lib/notes/services/notes.repository.supabase";

const repository = new SupabaseNotesRepository();

/**
 * POST /api/notes/:id/versions/:versionId/restore — restores the note's
 * content to this version. The current content is snapshotted first, so
 * this is never destructive.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const user = await requireUser();
  const { id, versionId } = await params;

  try {
    const restored = await restoreNoteVersion(id, user.id, versionId, { repository });
    if (!restored) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    return NextResponse.json({
      note: {
        id: restored.id,
        contentMd: restored.contentMd,
        wordCount: restored.wordCount,
        updatedAt: restored.updatedAt,
      },
    });
  } catch (err) {
    console.error(`POST /api/notes/${id}/versions/${versionId}/restore failed`, err);
    return NextResponse.json({ error: "Failed to restore this version" }, { status: 500 });
  }
}
