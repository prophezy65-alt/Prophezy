import type { NextRequest } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";
import { createCareerModuleProviders } from "@/lib/career/adapters/module-providers.adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/career/analytics[?targetRole=...].
 * resumeStrength comes from Resume Studio's ATS score; skillGapReadinessPercent
 * comes from the most recently saved skill gap report for targetRole — if
 * none exists yet, one is generated now (a real AI Core call) rather than
 * silently defaulting readiness to 0. This makes the first call for a newly
 * set role slower (an AI call, not just a DB read), but the number it
 * returns is always real.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);
    const targetRole = new URL(request.url).searchParams.get("targetRole")?.trim();

    const profileResult = await ctx.careerService.buildProfile(userId);
    if (!profileResult.ok || !profileResult.data) {
      return fail(new Error(profileResult.error?.message ?? "Failed to build career profile."));
    }
    const profile = profileResult.data;

    const resumeSummary = await createCareerModuleProviders(supabase).resumeStudio.getLatestResumeSummary(userId);
    const resumeStrength = resumeSummary?.atsScore ?? 0;

    const effectiveTargetRole = targetRole ?? profile.preferences.targetRoles?.[0];
    let skillGapReadinessPercent = 0;

    if (effectiveTargetRole) {
      let skillGapReport = await ctx.repository.getLatestSkillGapReport(userId, effectiveTargetRole);

      if (!skillGapReport) {
        const analysis = await ctx.skillsService.analyzeSkillGap(profile, effectiveTargetRole);
        if (analysis.ok && analysis.data) {
          await ctx.repository.saveSkillGapReport(userId, analysis.data);
          skillGapReport = analysis.data;
        }
        // If the AI call fails here, we deliberately fall through with
        // readiness at 0 rather than failing the whole analytics response —
        // the rest of the dashboard should still load.
      }

      skillGapReadinessPercent = skillGapReport?.overallReadinessPercent ?? 0;
    }

    const analytics = ctx.analyticsService.computeAnalytics(profile, resumeStrength, skillGapReadinessPercent);
    if (!analytics.ok || !analytics.data) {
      return fail(new Error(analytics.error?.message ?? "Failed to compute analytics."));
    }

    await ctx.repository.saveAnalyticsSnapshot(userId, analytics.data);

    return ok(analytics.data);
  } catch (error) {
    return fail(error);
  }
}
