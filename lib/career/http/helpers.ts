import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Request-scoped Supabase client + authenticated user, or throws. */
export async function requireCareerUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new UnauthorizedError();
  return { supabase, userId: user.id };
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: error.message } }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : "Something went wrong.";
  // eslint-disable-next-line no-console
  console.error("[career.api]", message, error);
  return NextResponse.json(
    { ok: false, error: { code: "CAREER_ENGINE_ERROR", message: "Something went wrong on our side." } },
    { status: 500 }
  );
}
