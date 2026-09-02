import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * SERVER-ONLY. Uses the service-role key, which bypasses RLS entirely.
 * Never import this file in a Client Component or expose it to the browser.
 * The `server-only` import above makes Next.js throw a build error if it
 * ever ends up in a client bundle by accident.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
