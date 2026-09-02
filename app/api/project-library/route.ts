/**
 * app/api/project-library/route.ts
 *
 * GET /api/project-library?search=&domain=&subdomain=&difficulty=&techStack=&skills=&page=&pageSize=
 *
 * Pure Supabase read. No Gemini/LLM call anywhere in this file or in
 * lib/project-library/query.service.ts. No credit deduction — this
 * endpoint never touches lib/credits/*.
 */

import { NextRequest, NextResponse } from "next/server";
import { listProjects } from "@/lib/project-library/query.service";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const difficultyParam = params.get("difficulty");
  if (difficultyParam && !["beginner", "intermediate", "advanced"].includes(difficultyParam)) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_DIFFICULTY", message: "difficulty must be beginner, intermediate, or advanced." } }, { status: 400 });
  }

  try {
    const result = await listProjects({
      search: params.get("search") ?? undefined,
      domain: params.get("domain") ?? undefined,
      subdomain: params.get("subdomain") ?? undefined,
      difficulty: (difficultyParam as "beginner" | "intermediate" | "advanced" | null) ?? undefined,
      techStack: params.get("techStack")?.split(",").filter(Boolean),
      skills: params.get("skills")?.split(",").filter(Boolean),
      maxEstimatedHours: params.get("maxEstimatedHours") ? Number(params.get("maxEstimatedHours")) : undefined,
      page: params.get("page") ? Number(params.get("page")) : undefined,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: "QUERY_FAILED", message: error instanceof Error ? error.message : "Unknown error." } }, { status: 500 });
  }
}
