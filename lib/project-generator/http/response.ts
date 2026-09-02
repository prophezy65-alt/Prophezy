/**
 * lib/project-generator/http/response.ts
 * Same {ok:true,data} / {ok:false,error} envelope as lib/flashcards/http/response.ts,
 * so frontend fetch wrappers can reuse the same apiFetch() pattern.
 */

import { NextResponse } from "next/server";
import { UnauthorizedError, NotFoundError, ValidationHttpError } from "./errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: error.message } }, { status: 401 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: error.message } }, { status: 404 });
  }
  if (error instanceof ValidationHttpError) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_error", message: error.message, issues: error.issues } },
      { status: 400 }
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: { code: "internal_error", message } }, { status: 500 });
}
