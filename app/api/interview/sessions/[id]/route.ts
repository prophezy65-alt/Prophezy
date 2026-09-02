import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, ok, fail, HttpError } from "@/lib/interview/http";
import { loadSessionDetail, toScoredQuestions } from "@/lib/interview/services/detail.service";
import { completeSession } from "@/lib/interview/services/session.service";
import { computeAnalyticsSnapshot } from "@/lib/interview/analytics/analytics.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["completed", "abandoned"]),
});

/**
 * GET /api/interview/sessions/:id
 * Full normalized detail: session + every question with its answer +
 * evaluation (null when not yet answered). Powers resume + report views.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await context.params;
    const detail = await loadSessionDetail(supabase, user.id, id);
    return ok(detail);
  } catch (error) {
    if (error instanceof Error && error.message === "Session not found.") {
      return fail(new HttpError(404, error.message));
    }
    return fail(error);
  }
}

/**
 * PATCH /api/interview/sessions/:id
 * Body: { status: "completed" | "abandoned" }.
 * On completion, builds the skill-gap roadmap + refreshes the analytics
 * snapshot (both persisted). Abandoning just closes the session.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await context.params;
    const { status } = patchSchema.parse(await request.json());

    const detail = await loadSessionDetail(supabase, user.id, id);

    if (status === "abandoned") {
      const { error } = await supabase
        .from("interview_sessions")
        .update({ status: "abandoned", ended_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return ok({ status: "abandoned", skillGap: null, analytics: null });
    }

    const scored = toScoredQuestions(detail);

    // Nothing evaluated yet — close it cleanly without an empty roadmap call.
    if (scored.length === 0) {
      const { error } = await supabase
        .from("interview_sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      const analytics = await computeAnalyticsSnapshot(supabase, user.id);
      return ok({ status: "completed", skillGap: null, analytics });
    }

    const { skillGap, analytics } = await completeSession(
      supabase,
      user.id,
      id,
      detail.session.role,
      scored,
    );
    return ok({ status: "completed", skillGap, analytics });
  } catch (error) {
    if (error instanceof Error && error.message === "Session not found.") {
      return fail(new HttpError(404, error.message));
    }
    return fail(error);
  }
}

/**
 * DELETE /api/interview/sessions/:id
 * Removes the session; questions/answers/evaluations cascade in the DB.
 */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await context.params;
    const { error } = await supabase
      .from("interview_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return ok({ removed: id });
  } catch (error) {
    return fail(error);
  }
}
