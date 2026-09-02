import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/ai/middleware/rate-limit";
import { generateContent } from "@/lib/resume-studio/services/generator.service";
import { aiGenerationRequestSchema, validate } from "@/lib/resume-studio/validation/resume.validation";
import { toResponse, unauthorized, badRequest } from "@/lib/resume-studio/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/resume-studio/ai — one-shot AI text generation for a resume
 *  section (or adjacent tasks like cover-letter/LinkedIn-about generation).
 *  Rate-limited under the existing "resume" bucket
 *  (see lib/ai/middleware/rate-limit.ts RATE_LIMIT_RULES) — note this
 *  module's own Gemini calls (services/ai/gemini.client.ts) don't go
 *  through the app's shared Core Engine (lib/ai/engine.ts), so this rate
 *  limit check is this route's own safety net, not automatic. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await enforceRateLimit(user.id, "resume");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: err instanceof Error ? err.message : "Rate limit exceeded." } },
      { status: 429 }
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (body === null) return badRequest("Request body must be valid JSON.");

  const validation = validate(aiGenerationRequestSchema, body);
  if (!validation.success) {
    return badRequest("Invalid AI generation request.", validation.errors);
  }

  const result = await generateContent(validation.data);
  return toResponse(result);
}
