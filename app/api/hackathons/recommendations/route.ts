import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { buildHackathonUserProfile } from "@/lib/hackathons/http/profile";
import { ok, fail } from "@/lib/hackathons/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hackathons/recommendations?limit=8 — personalized ranking
 * (always works, deterministic) with an AI-generated rationale per
 * recommendation when available (falls back to a deterministic rationale
 * built from the match-score breakdown if AI Core errors — see
 * recommendation.service.ts#buildRationale).
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit")) || 8;

    const profile = await buildHackathonUserProfile(user.id);
    const { recommendationService } = await buildHackathonModule();

    const result = await recommendationService.getRecommendations(profile, limit);
    if (!result.ok) throw new Error(result.error?.message ?? "Failed to generate recommendations.");

    return ok(result.data);
  } catch (error) {
    return fail(error);
  }
}
