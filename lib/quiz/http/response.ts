/**
 * lib/quiz/http/response.ts
 *
 * Tiny response helpers for the Quiz module's own API routes only — mirrors
 * the { error } / direct-JSON shape already used by app/api/uploads and the
 * { ok, data } shape used by app/api/internships closely enough that the
 * frontend doesn't need a third parsing convention. Not shared outside
 * lib/quiz.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AIValidationError } from "../../ai/utils/errors";
import { DocumentError } from "../../document/errors/document-errors";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request.", details: error.issues }, { status: 400 });
  }
  if (error instanceof UnauthorizedQuizError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenQuizError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundQuizError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof AIValidationError) {
    return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
  }
  if (error instanceof DocumentError) {
    return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  // eslint-disable-next-line no-console
  console.error("[quiz api]", error);

  if (process.env.NODE_ENV !== "production" && error instanceof Error && error.stack) {
    // Dev-only: pull the first stack frame that points into our own source
    // (skips node_modules/node:internal frames) so the error box shows
    // exactly where this actually happened, not just the message.
    const ownFrame = error.stack
      .split("\n")
      .slice(1)
      .find((line) => line.includes("/prophezy/") && !line.includes("node_modules"));
    return NextResponse.json({ error: message, _devLocation: ownFrame?.trim() ?? null }, { status: 500 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export class UnauthorizedQuizError extends Error {}
export class ForbiddenQuizError extends Error {}
export class NotFoundQuizError extends Error {}
