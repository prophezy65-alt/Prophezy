import { NextResponse, type NextRequest } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/career/skills?targetRole=... — latest saved skill gap report for that role. */
export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);
    const targetRole = new URL(request.url).searchParams.get("targetRole")?.trim();

    if (!targetRole) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "targetRole is required." } },
        { status: 400 }
      );
    }

    const report = await ctx.repository.getLatestSkillGapReport(userId, targetRole);
    return ok({ report });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/career/skills — { targetRole: string } -> runs (and persists) a fresh analysis. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    const body = (await request.json().catch(() => null)) as { targetRole?: string } | null;
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

    const analysis = await ctx.skillsService.analyzeSkillGap(profileResult.data, targetRole);
    if (!analysis.ok || !analysis.data) {
      return NextResponse.json(
        { ok: false, error: { code: analysis.error?.code ?? "SKILL_GAP_FAILED", message: analysis.error?.message ?? "Could not analyze skill gap." } },
        { status: 502 }
      );
    }

    await ctx.repository.saveSkillGapReport(userId, analysis.data);
    return ok({ report: analysis.data }, 201);
  } catch (error) {
    return fail(error);
  }
}
