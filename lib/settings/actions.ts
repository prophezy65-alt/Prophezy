"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/** Profile fields (bio, username, college, branch) aren't part of
 * /api/settings' user_settings — they live on public.profiles, which the
 * existing Settings system doesn't edit at all. This is purely additive. */
export async function updateProfile(input: {
  fullName: string;
  username: string | null;
  bio: string | null;
  college: string | null;
  branch: string | null;
  semester: number | null;
}): Promise<{ error: string | null }> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      username: input.username,
      bio: input.bio,
      college: input.college,
      branch: input.branch,
      semester: input.semester,
    })
    .eq("id", userId);
  revalidatePath("/app/settings");
  return { error: error?.message ?? null };
}

/** Clears this user's AI usage analytics log (ai_usage_events) — the Live
 * Analytics / AI Control Center numbers, not any of their notes, projects,
 * or generated content. */
export async function clearAnalyticsHistory(): Promise<{ error: string | null }> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("ai_usage_events").delete().eq("user_id", userId);
  revalidatePath("/app/settings");
  return { error: error?.message ?? null };
}
