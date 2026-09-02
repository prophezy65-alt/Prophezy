import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for server-only writes that must succeed regardless
// of RLS (e.g. support form submissions, where the table intentionally has
// no client-facing policies at all).
//
// IMPORTANT: only import this from server-side code (API routes, server
// components, route handlers). SUPABASE_SERVICE_ROLE_KEY must never be
// prefixed with NEXT_PUBLIC_ and must never reach the browser bundle. If
// you want a hard compile-time guard, add the `server-only` package
// (`npm install server-only`) and uncomment the import below.
// import "server-only";
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
