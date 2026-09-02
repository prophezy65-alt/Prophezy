/**
 * lib/notes/services/notes.repository.supabase.ts
 *
 * Real persistence for NotesRepository, against the REAL applied schema:
 *   - supabase/migrations/0007_notes.sql (generations + notes, content_md)
 *   - supabase/migrations/0035_notes_workspace.sql (folders, tags, pin,
 *     note_type/learning_mode/output_style, summary)
 *
 * This replaces the previous version of this file, which was written
 * against lib/notes/schema/0007_notes.proposed.sql — a schema that was
 * never actually applied (see lib/notes/README.md). Nothing outside
 * lib/notes/ imported from this file, so fixing it in place doesn't break
 * any consumer; notes.service.ts (the only real caller) is updated
 * alongside it in this same change.
 *
 * Follows the exact same pattern as lib/storage/uploads-repository.ts:
 * calls the real `createClient()` from "@/lib/supabase/server" per method
 * (it's cookie-bound and async), rather than taking an injected client.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { NotesRepository, ListNotesOptions } from "./notes.repository";
import type { Notes, NoteType, NoteVersion } from "../models/types";

type GenerationRow = Database["public"]["Tables"]["generations"]["Row"];
type NotesRow = Database["public"]["Tables"]["notes"]["Row"];
type NoteVersionRow = Database["public"]["Tables"]["note_versions"]["Row"];
type GenerationKind = Database["public"]["Enums"]["generation_kind"];

type JoinedRow = NotesRow & { generations: GenerationRow };

function rowToVersion(row: NoteVersionRow): NoteVersion {
  return {
    id: row.id,
    noteId: row.note_id,
    contentMd: row.content_md,
    wordCount: row.word_count,
    createdAt: row.created_at,
  };
}

/**
 * `generation_kind` (0002_enums.sql) only has a handful of note-shaped
 * values ('notes', 'revision_notes', 'mind_map', 'formula_sheet',
 * 'flashcards') — far fewer than the 16 specific NoteType values this
 * engine supports. Rather than alter that shared enum (used by every other
 * generation-producing feature), the precise NoteType is preserved in the
 * additive `note_type` text column, and `kind` maps to the closest broad
 * category for cross-feature queries/filtering that key off `kind`.
 */
function noteTypeToGenerationKind(noteType: NoteType): GenerationKind {
  switch (noteType) {
    case "mindmap":
      return "mind_map";
    case "flashcards":
      return "flashcards";
    case "formula_sheet":
      return "formula_sheet";
    case "revision":
      return "revision_notes";
    default:
      return "notes";
  }
}

function rowToNotes(row: JoinedRow): Notes {
  return {
    id: row.id,
    userId: row.generations.user_id,
    generationId: row.generation_id,
    title: row.generations.title,
    noteType: (row.generations.note_type ?? "detailed") as NoteType,
    learningMode: (row.generations.learning_mode ?? undefined) as Notes["learningMode"],
    outputStyle: (row.generations.output_style ?? undefined) as Notes["outputStyle"],
    folderId: row.generations.folder_id,
    tags: row.generations.tags ?? [],
    isPinned: row.generations.is_pinned,
    status: row.generations.status,
    contentMd: row.content_md,
    summary: row.summary,
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const JOINED_SELECT = "*, generations!inner(*)";

export class SupabaseNotesRepository implements NotesRepository {
  /**
   * Creates the parent `generations` row and the `notes` row together
   * (notes.generation_id is a required, unique FK — a note can't exist
   * without its generation). Used for brand-new notes; `update()` handles
   * edits to an existing pair.
   */
  async save(notes: Notes): Promise<Notes> {
    const supabase = await createClient();

    const { data: generation, error: genError } = await supabase
      .from("generations")
      .insert({
        id: notes.generationId,
        user_id: notes.userId,
        kind: noteTypeToGenerationKind(notes.noteType),
        title: notes.title?.trim() || "Untitled notes",
        status: notes.status,
        folder_id: notes.folderId,
        tags: notes.tags,
        is_pinned: notes.isPinned,
        note_type: notes.noteType,
        learning_mode: notes.learningMode ?? null,
        output_style: notes.outputStyle ?? null,
      })
      .select()
      .single();

    if (genError || !generation) {
      throw new Error(`SupabaseNotesRepository.save (generations) failed: ${genError?.message}`);
    }

    const { data: noteRow, error: noteError } = await supabase
      .from("notes")
      .insert({
        id: notes.id,
        generation_id: generation.id,
        content_md: notes.contentMd,
        word_count: notes.wordCount,
        summary: notes.summary,
      })
      .select()
      .single();

    if (noteError || !noteRow) {
      // Roll back the orphaned generation row rather than leaving a
      // generation with no note attached.
      await supabase.from("generations").delete().eq("id", generation.id);
      throw new Error(`SupabaseNotesRepository.save (notes) failed: ${noteError?.message}`);
    }

    return rowToNotes({ ...noteRow, generations: generation });
  }

  async getById(id: string): Promise<Notes | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes")
      .select(JOINED_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`SupabaseNotesRepository.getById failed: ${error.message}`);
    return data ? rowToNotes(data as unknown as JoinedRow) : null;
  }

  async listByUser(userId: string, options: ListNotesOptions = {}): Promise<Notes[]> {
    const supabase = await createClient();
    let query = supabase
      .from("notes")
      .select(JOINED_SELECT)
      .eq("generations.user_id", userId)
      .order("updated_at", { ascending: false });

    if (options.folderId !== undefined) {
      query = options.folderId === null
        ? query.is("generations.folder_id", null)
        : query.eq("generations.folder_id", options.folderId);
    }
    if (options.tag) {
      query = query.contains("generations.tags", [options.tag]);
    }
    if (options.pinnedOnly) {
      query = query.eq("generations.is_pinned", true);
    }
    if (options.query) {
      query = query.ilike("generations.title", `%${options.query}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`SupabaseNotesRepository.listByUser failed: ${error.message}`);
    return ((data ?? []) as unknown as JoinedRow[]).map(rowToNotes);
  }

  async deleteById(id: string): Promise<void> {
    const supabase = await createClient();

    // notes.generation_id -> generations on delete cascade, so deleting the
    // generation removes the note too — but we need the generation_id
    // first since the client only has the notes.id.
    const { data: note, error: fetchError } = await supabase
      .from("notes")
      .select("generation_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw new Error(`SupabaseNotesRepository.deleteById failed: ${fetchError.message}`);
    if (!note) return;

    const { error } = await supabase.from("generations").delete().eq("id", note.generation_id);
    if (error) throw new Error(`SupabaseNotesRepository.deleteById failed: ${error.message}`);
  }

  async update(
    id: string,
    patch: Partial<Pick<Notes, "title" | "contentMd" | "summary" | "folderId" | "tags" | "isPinned">>
  ): Promise<Notes> {
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("notes")
      .select(JOINED_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      throw new Error(`SupabaseNotesRepository.update: note not found (${fetchError?.message ?? id})`);
    }

    const joined = existing as unknown as JoinedRow;
    const generationPatch: Partial<GenerationRow> = {};
    if (patch.title !== undefined) generationPatch.title = patch.title.trim() || "Untitled notes";
    if (patch.folderId !== undefined) generationPatch.folder_id = patch.folderId;
    if (patch.tags !== undefined) generationPatch.tags = patch.tags;
    if (patch.isPinned !== undefined) generationPatch.is_pinned = patch.isPinned;

    if (Object.keys(generationPatch).length > 0) {
      const { error } = await supabase
        .from("generations")
        .update({ ...generationPatch, updated_at: new Date().toISOString() })
        .eq("id", joined.generation_id);
      if (error) throw new Error(`SupabaseNotesRepository.update (generations) failed: ${error.message}`);
    }

    const notePatch: Partial<NotesRow> = {};
    if (patch.contentMd !== undefined) {
      // Snapshot the CURRENT content before it's overwritten — version
      // history is "what did this look like before this edit", so the
      // snapshot always happens pre-write, never post-write.
      if (patch.contentMd !== joined.content_md) {
        const { error: versionError } = await supabase.from("note_versions").insert({
          note_id: id,
          content_md: joined.content_md,
          word_count: joined.word_count,
        });
        if (versionError) {
          throw new Error(`SupabaseNotesRepository.update (version snapshot) failed: ${versionError.message}`);
        }
      }

      notePatch.content_md = patch.contentMd;
      notePatch.word_count = patch.contentMd.trim().length
        ? patch.contentMd.trim().split(/\s+/).length
        : 0;
    }
    if (patch.summary !== undefined) notePatch.summary = patch.summary;

    let updatedNoteRow: NotesRow = joined;
    if (Object.keys(notePatch).length > 0) {
      const { data, error } = await supabase
        .from("notes")
        .update({ ...notePatch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error || !data) throw new Error(`SupabaseNotesRepository.update (notes) failed: ${error?.message}`);
      updatedNoteRow = data;
    }

    const { data: refreshedGeneration, error: refetchError } = await supabase
      .from("generations")
      .select("*")
      .eq("id", joined.generation_id)
      .single();
    if (refetchError || !refreshedGeneration) {
      throw new Error(`SupabaseNotesRepository.update: failed to refetch generation: ${refetchError?.message}`);
    }

    return rowToNotes({ ...updatedNoteRow, generations: refreshedGeneration });
  }

  async listVersions(noteId: string): Promise<NoteVersion[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("note_versions")
      .select("*")
      .eq("note_id", noteId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`SupabaseNotesRepository.listVersions failed: ${error.message}`);
    return (data ?? []).map(rowToVersion);
  }

  /**
   * Restores a note's content to a prior version. The CURRENT content is
   * snapshotted first (via the same insert `update()` uses), so restoring
   * is itself undoable — it just becomes the newest entry in the history.
   */
  async restoreVersion(noteId: string, versionId: string): Promise<Notes> {
    const supabase = await createClient();

    const { data: version, error: versionError } = await supabase
      .from("note_versions")
      .select("content_md")
      .eq("id", versionId)
      .eq("note_id", noteId)
      .maybeSingle();

    if (versionError || !version) {
      throw new Error(`SupabaseNotesRepository.restoreVersion: version not found (${versionError?.message ?? versionId})`);
    }

    return this.update(noteId, { contentMd: version.content_md });
  }
}
