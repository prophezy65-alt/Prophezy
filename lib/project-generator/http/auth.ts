/**
 * lib/project-generator/http/auth.ts
 * Same pattern as lib/flashcards/http/auth.ts and lib/assignment's equivalent:
 * wraps getCurrentUser() and throws instead of redirecting, since a JSON
 * API route can't sensibly respond to a redirect().
 */

import { getCurrentUser } from "@/lib/auth/session";
import { UnauthorizedError } from "./errors";

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
