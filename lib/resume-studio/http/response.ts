import { NextResponse } from "next/server";
import type { ServiceResult } from "../models/resume.model";

/** Maps a ResumeService/ATS/etc. ServiceResult error code to an HTTP status. */
function statusForCode(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "VALIDATION_FAILED":
    case "VALIDATION_ERROR":
    case "UNSUPPORTED_FILE_TYPE":
    case "PARSE_FAILED":
      return 400;
    case "UNAUTHENTICATED":
      return 401;
    default:
      return 500;
  }
}

/** Converts any of this module's `ServiceResult<T>` into a NextResponse,
 *  so route handlers can just `return toResponse(result)`. */
export function toResponse<T>(result: ServiceResult<T>, okStatus = 200): NextResponse {
  if (result.ok) {
    return NextResponse.json({ ok: true, data: result.data }, { status: okStatus });
  }
  const code = result.error?.code ?? "UNKNOWN_ERROR";
  return NextResponse.json(
    { ok: false, error: { code, message: result.error?.message ?? "Unknown error", details: result.error?.details } },
    { status: statusForCode(code) }
  );
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
    { status: 401 }
  );
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: "BAD_REQUEST", message, details } },
    { status: 400 }
  );
}

export function serverError(message = "Something went wrong."): NextResponse {
  return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
}
