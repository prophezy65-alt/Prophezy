/**
 * lib/notes/services/folders.service.ts
 *
 * CRUD for `notes_folders` (0035_notes_workspace.sql). Straightforward
 * owner-scoped persistence — RLS on the table already enforces ownership,
 * this just gives API routes a typed, single-purpose surface to call
 * instead of querying Supabase inline.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { NotesFolder } from "../models/types";

type FolderRow = Database["public"]["Tables"]["notes_folders"]["Row"];

function rowToFolder(row: FolderRow): NotesFolder {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const foldersService = {
  async list(userId: string): Promise<NotesFolder[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes_folders")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) throw new Error(`foldersService.list failed: ${error.message}`);
    return (data ?? []).map(rowToFolder);
  },

  async create(userId: string, name: string, color?: string): Promise<NotesFolder> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes_folders")
      .insert({ user_id: userId, name, color: color ?? "#5ff2ff" })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`foldersService.create failed: ${error?.message ?? "unknown error"}`);
    }
    return rowToFolder(data);
  },

  async rename(userId: string, folderId: string, patch: { name?: string; color?: string }): Promise<NotesFolder> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes_folders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", folderId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`foldersService.rename failed: ${error?.message ?? "not found"}`);
    }
    return rowToFolder(data);
  },

  /** Deletes the folder. Notes inside it are NOT deleted — generations.folder_id is `on delete set null`, so they just become unfiled. */
  async remove(userId: string, folderId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notes_folders")
      .delete()
      .eq("id", folderId)
      .eq("user_id", userId);

    if (error) throw new Error(`foldersService.remove failed: ${error.message}`);
  },
};
