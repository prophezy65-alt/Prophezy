import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// How long a "remembered" session's cookies live for. Supabase's own
// refresh token is long-lived, so this just controls how long the browser
// hangs on to it — middleware silently refreshes the access token before
// it expires regardless.
const REMEMBERED_MAX_AGE = 60 * 60 * 24 * 100; // 100 days

interface CreateClientOptions {
  /**
   * Controls how long the session survives.
   * - true (default): cookies persist across browser restarts — "stay
   *   signed in". This is the existing behavior everywhere else in the
   *   app, so it's the default and every existing `createClient()` call
   *   site is unaffected.
   * - false: cookies are set without an explicit Max-Age, i.e. real
   *   browser session cookies — cleared when the browser is fully closed,
   *   but still fine across page refreshes/tab closes within the same
   *   session. Used by the "Remember me" checkbox on the login form.
   */
  rememberMe?: boolean;
}

export function createClient(options?: CreateClientOptions) {
  const rememberMe = options?.rememberMe ?? true;

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    rememberMe
      ? { cookieOptions: { maxAge: REMEMBERED_MAX_AGE } }
      : undefined,
  );
}
