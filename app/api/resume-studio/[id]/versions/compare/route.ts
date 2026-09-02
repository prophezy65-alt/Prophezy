import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getResumeService } from "@/lib/resume-studio/repository/get-resume-service";
import { toResponse, unauthorized, badRequest } from "@/lib/resume-studio/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/resume-studio/:id/versions/compare?from=1&to=3 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const url = new URL(request.url);
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
    return badRequest("Query must include integer `from` and `to` version numbers.");
  }

  const service = await getResumeService();
  return toResponse(await service.compareVersions(id, from, to));
}
