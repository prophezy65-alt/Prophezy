/**
 * lib/payments/http.ts
 * Small self-contained auth + response helpers for the payments API
 * routes, matching the { ok, data } / { ok: false, error } envelope shape
 * used elsewhere in the app (see lib/internships/http/response.ts).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Resolves the current Supabase session. Always re-verifies against
 * Supabase Auth — never trusts a client-supplied user id. */
export async function requireUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "You must be signed in.");
  return { id: user.id, email: user.email ?? null };
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }
  // Never leak internal error details (Cashfree credentials, stack
  // traces, DB internals) to the client.
  console.error("[payments] unhandled error:", error);
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 }
  );
}
