import { NextResponse, type NextRequest } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPERIENCE_LEVELS = ["student", "fresher", "junior", "mid", "senior", "lead"] as const;
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return typeof value === "string" && (EXPERIENCE_LEVELS as readonly string[]).includes(value);
}

/** POST /api/career/salary — { role: string, country: string, experienceLevel: ExperienceLevel }. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    const body = (await request.json().catch(() => null)) as
      | { role?: string; country?: string; experienceLevel?: string; company?: string }
      | null;

    const role = body?.role?.trim();
    const country = body?.country?.trim();
    const experienceLevel = body?.experienceLevel;
    const company = body?.company?.trim() || undefined;

    if (!role || !country || !isExperienceLevel(experienceLevel)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: `role, country, and experienceLevel (one of: ${EXPERIENCE_LEVELS.join(", ")}) are required.`,
          },
        },
        { status: 400 }
      );
    }

    const result = await ctx.salaryService.estimateWithCommentary(role, country, experienceLevel, company);
    if (!result.ok || !result.data) {
      return fail(new Error(result.error?.message ?? "Failed to estimate salary."));
    }

    return ok(result.data);
  } catch (error) {
    return fail(error);
  }
}
