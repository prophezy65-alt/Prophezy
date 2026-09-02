import type { NextRequest } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/career/profile[?refresh=1] — aggregated career profile. */
export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    if (new URL(request.url).searchParams.get("refresh")) {
      await ctx.careerService.invalidateProfileCache(userId);
    }

    const result = await ctx.careerService.buildProfile(userId);
    if (!result.ok || !result.data) {
      return fail(new Error(result.error?.message ?? "Failed to build career profile."));
    }

    return ok(result.data);
  } catch (error) {
    return fail(error);
  }
}
