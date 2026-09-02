/**
 * app/api/project-generator/projects/[projectId]/favorite/route.ts
 * POST { favorite: boolean } - set favorite state.
 */

import { projectPersistenceService } from "@/lib/project-generator/services/project-persistence.service";
import { requireApiUser } from "@/lib/project-generator/http/auth";
import { ok, fail } from "@/lib/project-generator/http/response";
import { NotFoundError, ValidationHttpError } from "@/lib/project-generator/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;

    const body = (await request.json().catch(() => ({}))) as { favorite?: boolean };
    if (typeof body.favorite !== "boolean") {
      throw new ValidationHttpError("`favorite` (boolean) is required.");
    }

    const existing = await projectPersistenceService.getById(projectId, user.id);
    if (!existing) throw new NotFoundError("Project not found.");

    const updated = await projectPersistenceService.setFavorite(projectId, user.id, body.favorite);
    return ok({ project: updated });
  } catch (error) {
    return fail(error);
  }
}
