import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getResumeService } from "@/lib/resume-studio/repository/get-resume-service";
import { updateResumeSchema, validate } from "@/lib/resume-studio/validation/resume.validation";
import { toResponse, unauthorized, badRequest } from "@/lib/resume-studio/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/resume-studio/:id
 *  Note: RLS on public.resumes already scopes this to the caller's own rows
 *  (or an admin) — a resume that exists but belongs to someone else comes
 *  back as no row at all from Postgres's point of view, so this naturally
 *  resolves to NOT_FOUND without a separate ownership check here. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    console.warn("[resume-studio GET] no authenticated user for this request");
    return unauthorized();
  }

  const { id } = await params;
  console.log(`[resume-studio GET] user=${user.id} requesting resume=${id}`);

  const service = await getResumeService();
  const result = await service.getResume(id);

  if (!result.ok) {
    console.warn(`[resume-studio GET] NOT FOUND: user=${user.id} resume=${id} — code=${result.error?.code}`);
  } else {
    console.log(`[resume-studio GET] found: resume=${id} owned by user=${result.data!.userId} (requester=${user.id})`);
  }

  return toResponse(result);
}

/** PATCH /api/resume-studio/:id — partial update.
 *  - `content` present -> goes through updateResumeContent (bumps version,
 *    writes a resume_versions snapshot).
 *  - title/templateId/targetRole/targetJobDescription -> updateResumeMeta
 *    (no new version — these aren't "content" for versioning purposes).
 *  Both can be sent in the same request; content is applied first. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (body === null) return badRequest("Request body must be valid JSON.");

  const validation = validate(updateResumeSchema, body);
  if (!validation.success) {
    console.warn(`[resume-studio PATCH] validation failed for resume=${id} user=${user.id}:`, JSON.stringify(validation.errors));
    return badRequest("Invalid resume payload.", validation.errors);
  }

  const data = validation.data;
  const changeSummary =
    typeof body === "object" && body !== null && "changeSummary" in body
      ? String((body as Record<string, unknown>).changeSummary ?? "") || undefined
      : undefined;

  const meta = {
    title: data.title,
    templateId: data.templateId,
    targetRole: data.targetRole,
    targetJobDescription: data.targetJobDescription,
  };
  const hasMeta =
    meta.title !== undefined ||
    meta.templateId !== undefined ||
    meta.targetRole !== undefined ||
    meta.targetJobDescription !== undefined;

  const service = await getResumeService();

  if (data.content) {
    const result = await service.updateResumeContent(id, user.id, data.content, changeSummary);
    if (!result.ok || !hasMeta) return toResponse(result);
    return toResponse(await service.updateResumeMeta(id, user.id, meta));
  }

  if (!hasMeta) return badRequest("Request had no updatable fields.");
  return toResponse(await service.updateResumeMeta(id, user.id, meta));
}

/** DELETE /api/resume-studio/:id */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const service = await getResumeService();
  const result = await service.deleteResume(id, user.id);
  return toResponse(result);
}
