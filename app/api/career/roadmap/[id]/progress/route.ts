import { NextResponse } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/career/roadmap/[id]/progress — { milestoneId: string, completed: boolean }. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    const body = (await request.json().catch(() => null)) as { milestoneId?: string; completed?: boolean } | null;
    if (!body?.milestoneId || typeof body.completed !== "boolean") {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "milestoneId and completed are required." } },
        { status: 400 }
      );
    }

    const updated = await ctx.repository.setMilestoneProgress(userId, id, body.milestoneId, body.completed);
    if (!updated) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Roadmap not found." } }, { status: 404 });
    }

    return ok({ roadmap: updated });
  } catch (error) {
    return fail(error);
  }
}
