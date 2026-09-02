import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getResumeService } from "@/lib/resume-studio/repository/get-resume-service";
import { analyzeResume } from "@/lib/resume-studio/services/ats.service";
import { toResponse, unauthorized, badRequest, serverError } from "@/lib/resume-studio/http/response";
import type { Json } from "@/lib/supabase/types";
import type { AtsReport } from "@/lib/resume-studio/models/resume.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/resume-studio/:id/ats — run (and persist) an ATS scan.
 *  Body: { jobDescription?: string; includeAiAnalysis?: boolean } */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const jobDescription =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).jobDescription === "string"
      ? ((body as Record<string, unknown>).jobDescription as string)
      : undefined;
  const includeAiAnalysis =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).includeAiAnalysis === "boolean"
      ? ((body as Record<string, unknown>).includeAiAnalysis as boolean)
      : true;

  const service = await getResumeService();
  const resumeResult = await service.getResume(id);
  if (!resumeResult.ok || !resumeResult.data) return toResponse(resumeResult);
  if (resumeResult.data.userId !== user.id) {
    return toResponse({ ok: false, error: { code: "FORBIDDEN", message: "You do not have access to this resume." } });
  }

  console.log(`[resume-studio ATS] user=${user.id} resume=${id} starting analysis (includeAiAnalysis=${includeAiAnalysis})`);
  const analysisStart = Date.now();
  const analysis = await analyzeResume(resumeResult.data.content, { jobDescription, includeAiAnalysis });
  console.log(`[resume-studio ATS] analysis took ${Date.now() - analysisStart}ms, ok=${analysis.ok}${!analysis.ok ? ` code=${analysis.error?.code} msg=${analysis.error?.message}` : ""}`);
  if (!analysis.ok || !analysis.data) return toResponse(analysis);

  // Persist the scan. This is a nice-to-have for the history panel, so a
  // write failure here shouldn't fail the whole request — the caller still
  // gets their (already-computed) report either way.
  try {
    const supabase = await createClient();
    await supabase.from("ats_checks").insert({
      resume_id: id,
      job_description: jobDescription ?? "",
      score: analysis.data.overallScore,
      feedback: analysis.data as unknown as Json,
    });
  } catch {
    // swallow — see comment above
  }

  return toResponse(analysis);
}

/** GET /api/resume-studio/:id/ats — past ATS scan history for this resume,
 *  newest first. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const service = await getResumeService();
  const resumeResult = await service.getResume(id);
  if (!resumeResult.ok || !resumeResult.data) return toResponse(resumeResult);
  if (resumeResult.data.userId !== user.id) {
    return toResponse({ ok: false, error: { code: "FORBIDDEN", message: "You do not have access to this resume." } });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ats_checks")
      .select("*")
      .eq("resume_id", id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;

    const history = (data ?? []).map((row) => ({
      id: row.id,
      score: row.score,
      jobDescription: row.job_description,
      feedback: row.feedback as unknown as AtsReport,
      createdAt: row.created_at,
    }));
    return toResponse({ ok: true, data: history });
  } catch {
    return serverError("Failed to load ATS history.");
  }
}
