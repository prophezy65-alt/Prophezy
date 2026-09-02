/**
 * app/api/project-generator/projects/[projectId]/duplicate/route.ts
 * POST - creates an independent copy of the project's generated content.
 */

import { projectPersistenceService } from "@/lib/project-generator/services/project-persistence.service";
import { requireApiUser } from "@/lib/project-generator/http/auth";
import { ok, fail } from "@/lib/project-generator/http/response";
import { NotFoundError } from "@/lib/project-generator/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;

    const existing = await projectPersistenceService.getById(projectId, user.id);
    if (!existing) throw new NotFoundError("Project not found.");

    const copy = await projectPersistenceService.duplicate(projectId, user.id);
    return ok({ project: copy }, 201);
  } catch (error) {
    return fail(error);
  }
}
