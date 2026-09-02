/**
 * app/api/project-generator/projects/[projectId]/route.ts
 *
 * GET    - full saved project (all generated artifacts) + milestone completion
 * PATCH  - edit user-editable fields (title, description, links, progress)
 * DELETE - delete the project
 */

import { projectPersistenceService } from "@/lib/project-generator/services/project-persistence.service";
import { requireApiUser } from "@/lib/project-generator/http/auth";
import { ok, fail } from "@/lib/project-generator/http/response";
import { NotFoundError, ValidationHttpError } from "@/lib/project-generator/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;

    const project = await projectPersistenceService.getById(projectId, user.id);
    if (!project) throw new NotFoundError("Project not found.");

    const milestoneCompletion = await projectPersistenceService.listMilestoneCompletion(projectId);

    return ok({ project, milestoneCompletion });
  } catch (error) {
    return fail(error);
  }
}

interface PatchProjectBody {
  title?: string;
  description?: string;
  githubRepoUrl?: string | null;
  demoUrl?: string | null;
  progressPercent?: number;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;

    let body: PatchProjectBody;
    try {
      body = (await request.json()) as PatchProjectBody;
    } catch {
      throw new ValidationHttpError("Request body must be valid JSON.");
    }

    if (body.progressPercent !== undefined && (body.progressPercent < 0 || body.progressPercent > 100)) {
      throw new ValidationHttpError("progressPercent must be between 0 and 100.");
    }

    const existing = await projectPersistenceService.getById(projectId, user.id);
    if (!existing) throw new NotFoundError("Project not found.");

    const updated = await projectPersistenceService.update(projectId, user.id, body);
    return ok({ project: updated });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;

    const existing = await projectPersistenceService.getById(projectId, user.id);
    if (!existing) throw new NotFoundError("Project not found.");

    await projectPersistenceService.delete(projectId, user.id);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
