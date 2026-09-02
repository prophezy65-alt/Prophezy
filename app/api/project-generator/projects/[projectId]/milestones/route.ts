/**
 * app/api/project-generator/projects/[projectId]/milestones/route.ts
 * PATCH { taskId: string, completed: boolean } - toggle one roadmap task's
 * completion state. Also recomputes and persists progress_percent as
 * (completed tasks / total tasks in the roadmap), so the dashboard's
 * progress bar always reflects real checked-off work, not a stale value.
 */

import { projectPersistenceService } from "@/lib/project-generator/services/project-persistence.service";
import { requireApiUser } from "@/lib/project-generator/http/auth";
import { ok, fail } from "@/lib/project-generator/http/response";
import { NotFoundError, ValidationHttpError } from "@/lib/project-generator/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ToggleMilestoneBody {
  taskId: string;
  completed: boolean;
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;

    let body: ToggleMilestoneBody;
    try {
      body = (await request.json()) as ToggleMilestoneBody;
    } catch {
      throw new ValidationHttpError("Request body must be valid JSON.");
    }
    if (!body.taskId || typeof body.completed !== "boolean") {
      throw new ValidationHttpError("`taskId` (string) and `completed` (boolean) are required.");
    }

    const project = await projectPersistenceService.getById(projectId, user.id);
    if (!project) throw new NotFoundError("Project not found.");
    if (!project.roadmap) throw new ValidationHttpError("This project has no roadmap yet.");

    const taskExists = project.roadmap.tasks.some((t) => t.id === body.taskId);
    if (!taskExists) throw new ValidationHttpError(`Task "${body.taskId}" does not exist on this project's roadmap.`);

    await projectPersistenceService.setMilestoneCompletion(projectId, body.taskId, body.completed);

    const completion = await projectPersistenceService.listMilestoneCompletion(projectId);
    const totalTasks = project.roadmap.tasks.length;
    const completedTasks = project.roadmap.tasks.filter((t) => completion[t.id]).length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const updated = await projectPersistenceService.update(projectId, user.id, { progressPercent });

    return ok({ project: updated, milestoneCompletion: completion });
  } catch (error) {
    return fail(error);
  }
}
