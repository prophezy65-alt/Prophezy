import { NextResponse } from "next/server";
import { StudyHubError } from "../errors";

// Same {ok, data} / {ok:false, error} envelope shape the internship module
// uses — keeps the API contract consistent across the app without creating
// a dependency from this module on internship-specific internals.
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof StudyHubError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side." } },
    { status: 500 },
  );
}
