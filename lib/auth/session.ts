import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

/** Returns the signed-in user, or null. Never redirects — use in places
 *  where an anonymous visitor is a valid state (e.g. the landing page). */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the signed-in user's profile row (role, name, etc.), or null. */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

/** For Server Components / Route Handlers behind a protected route.
 *  Redirects to /login if there's no session. Middleware already covers
 *  most cases — this is the defense-in-depth check for the page itself. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Same as requireUser, but also enforces a specific role (e.g. "admin").
 *  Redirects non-matching users into the app instead of exposing a 403. */
export async function requireRole(role: UserRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== role) redirect("/app");
  return user;
}
