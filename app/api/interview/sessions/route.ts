import type { NextRequest } from "next/server";
import { requireAuth, ok, fail } from "@/lib/interview/http";
import { startSessionSchema } from "@/lib/validations/interview";
import { createSession } from "@/lib/interview/services/session.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/interview/sessions
 * Returns the signed-in user's interview session history (most recent first).
 */
export async function GET() {
  try {
    const { supabase, user } = await requireAuth();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("id, role, interview_type, company, seniority, status, started_at, ended_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ok(data ?? []);
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/interview/sessions
 * Body: startSessionSchema — generates a tailored question set via Gemini,
 * persists the session + questions, and returns both.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const body = (await request.json()) as unknown;
    const params = startSessionSchema.parse(body);
    const result = await createSession(supabase, user.id, params);
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
