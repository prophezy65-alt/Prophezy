import { createClient } from "@supabase/supabase-js";

// Anon-key client for client components that call public, RLS-safe RPCs
// (e.g. toggle_blog_like). This never touches the service-role key.
let browserClient: ReturnType<typeof createClient> | null = null;

export function getBrowserSupabase() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  browserClient = createClient(url, anonKey);
  return browserClient;
}
