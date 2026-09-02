import { NextResponse } from "next/server";
import { UnauthorizedError, NotFoundError } from "./errors";
import { ZodError } from "zod";
import { AiCoreError } from "../providers/ai-core.provider";

export function fail(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join(".") || "request"}: ${first.message}` : "Invalid request." },
      { status: 400 }
    );
  }
  if (error instanceof AiCoreError) {
    // AI enhancement failures never take down a request — services that
    // call AI Core already fall back to deterministic behavior
    // (recommendation.service.ts's buildRationale, for example). Seeing
    // this here would mean a bug in that fallback, not a request the user
    // should retry — still a real error worth a 502, not swallowed.
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  console.error("[hackathons-api]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
