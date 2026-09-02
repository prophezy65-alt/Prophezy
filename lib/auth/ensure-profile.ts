import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Ensures a `profiles` row exists for the given user. Safe to call on
 * every sign-in — it's a single cheap SELECT when the row already exists
 * (the common case, e.g. if a `handle_new_user` trigger on auth.users
 * already creates it). Only inserts when the row is genuinely missing,
 * so it acts as defense-in-depth rather than a replacement for that
 * trigger, and it never overwrites a profile the user has since edited.
 *
 * `full_name` is required by the schema, so we fall back through the
 * places a name could plausibly live depending on the sign-in method:
 * OAuth providers (Google/GitHub) populate `full_name` or `name`;
 * email/password signup passes `full_name` explicitly via `options.data`.
 */
export async function ensureProfile(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError || existing) return;

  const metadata = user.user_metadata ?? {};
  const fullName: string =
    metadata.full_name || metadata.name || (user.email ? user.email.split("@")[0] : "New Student");

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    full_name: fullName,
    avatar_url: metadata.avatar_url || metadata.picture || null,
  });

  // A unique-violation here just means another request created the row a
  // moment earlier (e.g. a DB trigger) — not a real failure.
  if (insertError && insertError.code !== "23505") {
    console.error("ensureProfile: failed to create profile", insertError);
  }
}
