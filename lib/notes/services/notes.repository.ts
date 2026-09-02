/**
 * lib/notes/services/notes.repository.ts
 *
 * Persistence boundary for generated notes. notes.service.ts depends on
 * the `NotesRepository` interface, not on Supabase directly — so swapping
 * `InMemoryNotesRepository` for a real `SupabaseNotesRepository` (Part 2,
 * once 0007_notes.sql defines the `notes`/`generations` tables) is a
 * one-line change at the call site below, not a rewrite of the service.
 *
 * `InMemoryNotesRepository` is a genuine, fully working implementation —
 * not a mock — it just doesn't survive a process restart. It's suitable
 * for local dev and for unit-testing notes.service.ts today.
 */

import type { Notes, NoteVersion } from "../models/types";

export interface ListNotesOptions {
  folderId?: string | null;
  tag?: string;
  query?: string;
  pinnedOnly?: boolean;
}

export interface NotesRepository {
  save(notes: Notes): Promise<Notes>;
  getById(id: string): Promise<Notes | null>;
  listByUser(userId: string, options?: ListNotesOptions): Promise<Notes[]>;
  deleteById(id: string): Promise<void>;
  /** Partial update for auto-save (content) and metadata edits (title/folder/tags/pin) without a full save() round-trip. */
  update(id: string, patch: Partial<Pick<Notes, "title" | "contentMd" | "summary" | "folderId" | "tags" | "isPinned">>): Promise<Notes>;
  /** Version history, most recent first. A version is snapshotted automatically by update() whenever contentMd changes. */
  listVersions(noteId: string): Promise<NoteVersion[]>;
  /** Restores a note's content to a prior version (itself snapshotting the current content first, so restoring is never destructive). */
  restoreVersion(noteId: string, versionId: string): Promise<Notes>;
}

export class InMemoryNotesRepository implements NotesRepository {
  private readonly byId = new Map<string, Notes>();
  private readonly versionsByNote = new Map<string, NoteVersion[]>();
  private versionCounter = 0;

  async save(notes: Notes): Promise<Notes> {
    this.byId.set(notes.id, notes);
    return notes;
  }

  async getById(id: string): Promise<Notes | null> {
    return this.byId.get(id) ?? null;
  }

  async listByUser(userId: string, options: ListNotesOptions = {}): Promise<Notes[]> {
    let results = Array.from(this.byId.values()).filter((n) => n.userId === userId);

    if (options.folderId !== undefined) {
      results = results.filter((n) => n.folderId === options.folderId);
    }
    if (options.tag) {
      results = results.filter((n) => n.tags.includes(options.tag!));
    }
    if (options.pinnedOnly) {
      results = results.filter((n) => n.isPinned);
    }
    if (options.query) {
      const q = options.query.toLowerCase();
      results = results.filter(
        (n) => n.title.toLowerCase().includes(q) || n.contentMd.toLowerCase().includes(q)
      );
    }

    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteById(id: string): Promise<void> {
    this.byId.delete(id);
    this.versionsByNote.delete(id);
  }

  async update(
    id: string,
    patch: Partial<Pick<Notes, "title" | "contentMd" | "summary" | "folderId" | "tags" | "isPinned">>
  ): Promise<Notes> {
    const existing = this.byId.get(id);
    if (!existing) throw new Error(`Notes not found: ${id}`);

    if (patch.contentMd !== undefined && patch.contentMd !== existing.contentMd) {
      this.snapshotVersion(existing);
    }

    const updated: Notes = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.byId.set(id, updated);
    return updated;
  }

  async listVersions(noteId: string): Promise<NoteVersion[]> {
    return [...(this.versionsByNote.get(noteId) ?? [])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  async restoreVersion(noteId: string, versionId: string): Promise<Notes> {
    const existing = this.byId.get(noteId);
    if (!existing) throw new Error(`Notes not found: ${noteId}`);

    const version = (this.versionsByNote.get(noteId) ?? []).find((v) => v.id === versionId);
    if (!version) throw new Error(`Version not found: ${versionId}`);

    this.snapshotVersion(existing);

    const restored: Notes = {
      ...existing,
      contentMd: version.contentMd,
      wordCount: version.wordCount,
      updatedAt: new Date().toISOString(),
    };
    this.byId.set(noteId, restored);
    return restored;
  }

  private snapshotVersion(notes: Notes): void {
    const versions = this.versionsByNote.get(notes.id) ?? [];
    versions.push({
      id: `v_${++this.versionCounter}`,
      noteId: notes.id,
      contentMd: notes.contentMd,
      wordCount: notes.wordCount,
      createdAt: notes.updatedAt,
    });
    this.versionsByNote.set(notes.id, versions);
  }
}

/**
 * Process-wide default instance. notes.service.ts uses this unless a
 * caller injects its own repository (e.g. a test double, or the future
 * SupabaseNotesRepository).
 */
export const defaultNotesRepository: NotesRepository = new InMemoryNotesRepository();
