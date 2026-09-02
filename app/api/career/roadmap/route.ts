import { NextResponse, type NextRequest } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/career/roadmap — every roadmap the user has generated, newest first. */
export async function GET() {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);
    const roadmaps = await ctx.repository.listRoadmaps(userId);
    return ok({ roadmaps });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/career/roadmap — { targetRole: string, weeksAvailable?: number }. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    const body = (await request.json().catch(() => null)) as { targetRole?: string; weeksAvailable?: number } | null;
    const targetRole = body?.targetRole?.trim();
    if (!targetRole) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "targetRole is required." } },
        { status: 400 }
      );
    }

    const profileResult = await ctx.careerService.buildProfile(userId);
    if (!profileResult.ok || !profileResult.data) {
      return fail(new Error(profileResult.error?.message ?? "Failed to build career profile."));
    }

    const roadmapResult = await ctx.roadmapService.generateRoadmap(profileResult.data, targetRole, body?.weeksAvailable);
    if (!roadmapResult.ok || !roadmapResult.data) {
      return fail(new Error(roadmapResult.error?.message ?? "Failed to generate roadmap."));
    }
    if (roadmapResult.data.milestones.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "ROADMAP_EMPTY",
            message:
              "Couldn't generate a roadmap for this exact role right now. Try a more common role title (e.g. \"Software Engineer\" instead of a very specific/unusual title), or try again in a moment.",
          },
        },
        { status: 502 }
      );
    }

    const saved = await ctx.repository.saveRoadmap(userId, roadmapResult.data);
    // Replace any previous roadmap(s) for this exact role so the list doesn't
    // accumulate duplicates every time you regenerate for the same target.
    const previous = await ctx.repository.listRoadmaps(userId);
    const staleIds = previous.filter((r) => r.targetRole === saved.targetRole && r.id !== saved.id).map((r) => r.id);
    await Promise.all(staleIds.map((id) => ctx.repository.deleteRoadmap(userId, id)));

    return ok({ roadmap: saved }, 201);
  } catch (error) {
    return fail(error);
  }
}
