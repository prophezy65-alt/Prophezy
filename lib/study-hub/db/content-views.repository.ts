import "server-only";
import { createClient } from "@/lib/supabase/server";
import { StudyHubError } from "../errors";
import type { ContentView, StudyEntityType } from "../types";

function toContentView(row: {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  viewed_at: string;
}): ContentView {
  return {
    id: row.id,
    userId: row.user_id,
    entityType: row.entity_type as StudyEntityType,
    entityId: row.entity_id,
    viewedAt: row.viewed_at,
  };
}

export class ContentViewsRepository {
  async record(userId: string, entityType: StudyEntityType, entityId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("content_views")
      .upsert(
        { user_id: userId, entity_type: entityType, entity_id: entityId, viewed_at: new Date().toISOString() },
        { onConflict: "user_id,entity_type,entity_id" },
      );

    if (error) throw new StudyHubError(error.message, "DB_WRITE_FAILED", 500);
  }

  async listRecent(userId: string, entityType?: StudyEntityType, limit = 20): Promise<ContentView[]> {
    const supabase = await createClient();
    let query = supabase
      .from("content_views")
      .select("*")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(limit);

    if (entityType) query = query.eq("entity_type", entityType);

    const { data, error } = await query;
    if (error) throw new StudyHubError(error.message, "DB_READ_FAILED", 500);
    return (data ?? []).map(toContentView);
  }
}
