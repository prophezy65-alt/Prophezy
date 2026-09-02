/**
 * lib/interview/http.ts
 *
 * Thin, module-local HTTP helpers for the Interview Intelligence Engine's
 * route handlers. Mirrors the plain `NextResponse.json` + Supabase-SSR
 * convention already used by app/api/account and app/api/uploads, rather
 * than coupling the interview routes to the internships module's own
 * `ok`/`fail`/`requireUser` helpers.
 *
 * All responses use a consistent envelope so the frontend can unwrap them
 * with a single helper:  { ok: true, data } | { ok: false, error }.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type TypedSupabaseClient = SupabaseClient<Database>;

/** Error whose HTTP status is carried alongside the message. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Resolves the signed-in user and a typed server Supabase client. Throws a
 * 401 HttpError when there is no session — caught by `fail()` in the route.
 */
export async function requireAuth(): Promise<{ supabase: TypedSupabaseClient; user: User }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "You must be signed in.");
  return { supabase, user };
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const message = error.issues.map((i) => i.message).join("; ") || "Invalid request.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
  if (error instanceof HttpError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected error.";
  // Duplicate-key on interview_answers.question_id → the question was already answered.
  if (/duplicate key|already exists|unique constraint/i.test(message)) {
    return NextResponse.json(
      { ok: false, error: "This question has already been answered." },
      { status: 409 },
    );
  }
  console.error("[interview.api]", error);
  // In development, surface the real cause (e.g. a missing table) so it's
  // debuggable; in production keep the message generic.
  return NextResponse.json(
    {
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Something went wrong on our side." : message,
    },
    { status: 500 },
  );
}
