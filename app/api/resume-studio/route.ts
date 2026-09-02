import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getResumeService } from "@/lib/resume-studio/repository/get-resume-service";
import { createResumeSchema, validate } from "@/lib/resume-studio/validation/resume.validation";
import { toResponse, unauthorized, badRequest } from "@/lib/resume-studio/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/resume-studio — list the current user's resumes. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const service = await getResumeService();
  const result = await service.listResumes(user.id);
  if (result.ok) {
    console.log(`[resume-studio LIST] user=${user.id} has ${result.data!.length} resume(s): ${result.data!.map((r) => r.id).join(", ") || "(none)"}`);
  }
  return toResponse(result);
}

/** POST /api/resume-studio — create a new resume. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body: unknown = await request.json().catch(() => null);
  if (body === null) return badRequest("Request body must be valid JSON.");

  const validation = validate(createResumeSchema, body);
  if (!validation.success) {
    console.warn(`[resume-studio CREATE] validation failed for user=${user.id}:`, JSON.stringify(validation.errors));
    return badRequest("Invalid resume payload.", validation.errors);
  }

  const service = await getResumeService();
  const result = await service.createResume({
    userId: user.id,
    title: validation.data.title,
    templateId: validation.data.templateId,
    content: validation.data.content,
    targetRole: validation.data.targetRole,
    targetJobDescription: validation.data.targetJobDescription,
  });

  if (result.ok) {
    console.log(`[resume-studio CREATE] user=${user.id} created resume=${result.data!.id} (stored userId=${result.data!.userId})`);
  } else {
    console.error(`[resume-studio CREATE] failed for user=${user.id}: ${result.error?.code} — ${result.error?.message}`);
  }

  return toResponse(result, 201);
}
