import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getNotes } from "@/lib/notes/services/notes.service";
import { SupabaseNotesRepository } from "@/lib/notes/services/notes.repository.supabase";
import { exportNoteMarkdown } from "@/lib/notes/services/markdown-export.service";
import { exportNoteQuerySchema } from "@/lib/validations/notes";

const repository = new SupabaseNotesRepository();

/** GET /api/notes/:id/export?format=markdown|html|txt|json|csv|docx|pdf */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const parsed = exportNoteQuerySchema.safeParse({ format: searchParams.get("format") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or missing format", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const notes = await getNotes(id, user.id, { repository });
    if (!notes) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const result = await exportNoteMarkdown(notes.contentMd, notes.title, parsed.data.format);
    const safeName = notes.title.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "note";

    return new NextResponse(result.data as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${safeName}.${result.fileExtension}"`,
      },
    });
  } catch (err) {
    console.error(`GET /api/notes/${id}/export failed`, err);
    return NextResponse.json({ error: "Failed to export note" }, { status: 500 });
  }
}
