import "server-only";
import { createClient } from "@/lib/supabase/server";
import { StudyHubError } from "../errors";
import type { Bookmark, StudyEntityType } from "../types";

function toBookmark(row: {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}): Bookmark {
  return {
    id: row.id,
    userId: row.user_id,
    entityType: row.entity_type as StudyEntityType,
    entityId: row.entity_id,
    createdAt: row.created_at,
  };
}

export class BookmarksRepository {
  async list(userId: string, entityType?: StudyEntityType): Promise<Bookmark[]> {
    const supabase = await createClient();
    let query = supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (entityType) query = query.eq("entity_type", entityType);

    const { data, error } = await query;
    if (error) throw new StudyHubError(error.message, "DB_READ_FAILED", 500);
    return (data ?? []).map(toBookmark);
  }

  async add(userId: string, entityType: StudyEntityType, entityId: string): Promise<Bookmark> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bookmarks")
      .upsert(
        { user_id: userId, entity_type: entityType, entity_id: entityId },
        { onConflict: "user_id,entity_type,entity_id", ignoreDuplicates: false },
      )
      .select()
      .single();

    if (error || !data) throw new StudyHubError(error?.message ?? "Failed to bookmark.", "DB_WRITE_FAILED", 500);
    return toBookmark(data);
  }

  async remove(userId: string, entityType: StudyEntityType, entityId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);

    if (error) throw new StudyHubError(error.message, "DB_WRITE_FAILED", 500);
  }
}
