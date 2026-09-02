/**
 * lib/flashcards/http/response.ts
 *
 * Consistent JSON envelope for every flashcards route: `{ ok: true, data }`
 * on success, `{ ok: false, error: { code, message, issues? } }` on
 * failure — same shape lib/internships/http/response.ts already
 * established for the one other module in this app with real API routes,
 * so the frontend doesn't have to special-case flashcards' error format.
 */

import { NextResponse } from "next/server";
import { AIValidationError } from "@/lib/ai/utils/errors";
import { UnauthorizedError, NotFoundError, ForbiddenError } from "./errors";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: error.message } }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: error.message } }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: error.message } }, { status: 404 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_error", message: "Invalid request.", issues: error.issues } },
      { status: 400 }
    );
  }
  if (error instanceof AIValidationError) {
    const status = /not found/i.test(error.message) ? 404 : 400;
    return NextResponse.json(
      { ok: false, error: { code: "validation_error", message: error.message, issues: error.issues } },
      { status }
    );
  }

  const message = error instanceof Error ? error.message : "Something went wrong.";
  console.error("[flashcards-api]", error);
  return NextResponse.json({ ok: false, error: { code: "internal_error", message } }, { status: 500 });
}
