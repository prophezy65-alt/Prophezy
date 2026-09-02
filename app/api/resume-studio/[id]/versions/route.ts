import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getResumeService } from "@/lib/resume-studio/repository/get-resume-service";
import { toResponse, unauthorized, badRequest } from "@/lib/resume-studio/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/resume-studio/:id/versions — version history, newest first. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const service = await getResumeService();

  // Ownership check (RLS also enforces this, but returning FORBIDDEN vs a
  // bare empty list gives the UI a clearer signal for "not yours" vs "no
  // versions yet").
  const resume = await service.getResume(id);
  if (!resume.ok) return toResponse(resume);
  if (resume.data && resume.data.userId !== user.id) return toResponse(resume);

  return toResponse(await service.listVersions(id));
}

/** POST /api/resume-studio/:id/versions — restore a prior version.
 *  Body: { version: number } */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const version = body && typeof body === "object" ? (body as Record<string, unknown>).version : undefined;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return badRequest("Body must include an integer `version` >= 1.");
  }

  const service = await getResumeService();
  return toResponse(await service.restoreVersion(id, user.id, version));
}
