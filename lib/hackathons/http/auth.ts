/**
 * lib/hackathons/http/auth.ts
 *
 * Read-only use of the EXISTING, unmodified getCurrentUser() from
 * @/lib/auth/session — no auth code touched, per "integrate Authentication
 * at the very end / do not modify login, signup, middleware, session
 * handling, Supabase Auth, or authentication flows." Same pattern already
 * used by lib/flashcards/http/auth.ts and lib/notes/http/auth.ts.
 */
import { getCurrentUser } from "@/lib/auth/session";
import { UnauthorizedError } from "./errors";

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
