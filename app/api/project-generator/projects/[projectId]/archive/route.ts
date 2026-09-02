/**
 * app/api/project-generator/projects/[projectId]/archive/route.ts
 * POST { archived: boolean } - set archived state.
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

    const body = (await request.json().catch(() => ({}))) as { archived?: boolean };
    if (typeof body.archived !== "boolean") {
      throw new ValidationHttpError("`archived` (boolean) is required.");
    }

    const existing = await projectPersistenceService.getById(projectId, user.id);
    if (!existing) throw new NotFoundError("Project not found.");

    const updated = await projectPersistenceService.setArchived(projectId, user.id, body.archived);
    return ok({ project: updated });
  } catch (error) {
    return fail(error);
  }
}
