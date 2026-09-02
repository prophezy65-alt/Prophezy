import { NextResponse, type NextRequest } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECOMMENDATION_KINDS = [
  "career_path",
  "company",
  "industry",
  "certification",
  "course",
  "project",
  "career_switch",
  "startup",
  "freelance",
  "remote",
] as const;

type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

function isRecommendationKind(value: unknown): value is RecommendationKind {
  return typeof value === "string" && (RECOMMENDATION_KINDS as readonly string[]).includes(value);
}

/** POST /api/career/recommendations — { kind, limit? } or { kind: "higher_studies" }. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    const body = (await request.json().catch(() => null)) as { kind?: string; limit?: number } | null;
    const kind = body?.kind;

    const profileResult = await ctx.careerService.buildProfile(userId);
    if (!profileResult.ok || !profileResult.data) {
      return fail(new Error(profileResult.error?.message ?? "Failed to build career profile."));
    }
    const profile = profileResult.data;

    if (kind === "higher_studies") {
      const guidance = await ctx.recommendationService.getAllHigherStudiesGuidance(profile);
      if (!guidance.ok) {
        return NextResponse.json(
          { ok: false, error: { code: guidance.error?.code ?? "GUIDANCE_FAILED", message: guidance.error?.message } },
          { status: 502 }
        );
      }
      return ok({ kind, higherStudies: guidance.data ?? [] });
    }

    if (!isRecommendationKind(kind)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: `kind must be one of: ${RECOMMENDATION_KINDS.join(", ")}, higher_studies`,
          },
        },
        { status: 400 }
      );
    }

    const result = await ctx.recommendationService.getRecommendations(profile, kind, body?.limit ?? 8);
    if (!result.ok || !result.data) {
      return NextResponse.json(
        { ok: false, error: { code: result.error?.code ?? "RECOMMENDATION_FAILED", message: result.error?.message } },
        { status: 502 }
      );
    }

    // Defensive normalization: the model is instructed to return
    // confidenceScore on a 0-100 scale, but sometimes returns a 0-1
    // fraction instead. Detect and correct either case so the UI never
    // shows a misleading "1%" for a high-confidence recommendation.
    const recommendations = result.data.map((rec) => ({
      ...rec,
      confidenceScore: rec.confidenceScore <= 1 ? Math.round(rec.confidenceScore * 100) : Math.round(rec.confidenceScore),
    }));

    return ok({ kind, recommendations });
  } catch (error) {
    return fail(error);
  }
}
