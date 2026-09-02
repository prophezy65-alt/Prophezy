/**
 * lib/flashcards/http/auth.ts
 *
 * `@/lib/auth/session`'s `requireUser()` calls `redirect("/login")` on no
 * session — correct for a Server Component, wrong for a JSON API route
 * (a redirect response isn't a sensible reply to `fetch()`). This wraps
 * the same underlying `getCurrentUser()` and throws instead, so route
 * handlers can catch it and return a proper 401 JSON body.
 */

import { getCurrentUser } from "@/lib/auth/session";
import { UnauthorizedError } from "./errors";

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
