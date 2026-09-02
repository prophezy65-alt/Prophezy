/**
 * lib/project-generator/models/roadmap.model.ts
 *
 * Breaks a ProjectSpec into an executable roadmap: phases, tasks,
 * milestones, dependencies and a timeline.
 */

import { RoadmapPhaseName, TaskPriority, DifficultyLevel } from "./enums";
import { UUID, NumericRange, isValidNumericRange, isUUID } from "./shared.model";

export interface RoadmapTask {
  readonly id: UUID;
  readonly title: string;
  readonly description: string;
  readonly moduleId: UUID | null; // links back to ProjectModule.id when applicable
  readonly priority: TaskPriority;
  readonly difficulty: DifficultyLevel;
  readonly estimatedHours: NumericRange;
  readonly dependsOnTaskIds: readonly UUID[];
}

export interface RoadmapPhase {
  readonly id: UUID;
  readonly name: RoadmapPhaseName;
  readonly title: string;
  readonly goal: string;
  readonly taskIds: readonly UUID[];
  readonly order: number;
}

export interface Milestone {
  readonly id: UUID;
  readonly title: string;
  readonly description: string;
  readonly phaseId: UUID;
  readonly acceptanceCriteria: readonly string[];
}

export interface TimelineEntry {
  readonly phaseId: UUID;
  readonly startWeek: number; // relative week number, 1-indexed
  readonly endWeek: number;
}

export interface Roadmap {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly phases: readonly RoadmapPhase[];
  readonly tasks: readonly RoadmapTask[];
  readonly milestones: readonly Milestone[];
  readonly timeline: readonly TimelineEntry[];
  readonly totalEstimatedHours: NumericRange;
}

export function getTasksForPhase(roadmap: Roadmap, phaseId: UUID): RoadmapTask[] {
  const phase = roadmap.phases.find((p) => p.id === phaseId);
  if (!phase) return [];
  const idSet = new Set(phase.taskIds);
  return roadmap.tasks.filter((t) => idSet.has(t.id));
}

/**
 * Topologically checks that task dependency graph has no cycles.
 * Returns the list of task ids involved in a cycle, or an empty array
 * if the graph is a valid DAG.
 */
export function findDependencyCycle(tasks: readonly RoadmapTask[]): UUID[] {
  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const visiting = new Set<UUID>();
  const visited = new Set<UUID>();
  const stack: UUID[] = [];

  function visit(taskId: UUID): UUID[] | null {
    if (visited.has(taskId)) return null;
    if (visiting.has(taskId)) {
      const cycleStart = stack.indexOf(taskId);
      return stack.slice(cycleStart).concat(taskId);
    }
    const task = taskById.get(taskId);
    if (!task) return null;

    visiting.add(taskId);
    stack.push(taskId);
    for (const dep of task.dependsOnTaskIds) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(taskId);
    visited.add(taskId);
    return null;
  }

  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle) return cycle;
  }
  return [];
}

export function validateRoadmap(roadmap: Roadmap): string[] {
  const problems: string[] = [];

  if (!isUUID(roadmap.id)) problems.push("Roadmap.id must be a UUID.");
  if (!isUUID(roadmap.projectSpecId)) problems.push("Roadmap.projectSpecId must be a UUID.");
  if (roadmap.phases.length === 0) problems.push("Roadmap.phases must contain at least one phase.");
  if (!isValidNumericRange(roadmap.totalEstimatedHours)) {
    problems.push("Roadmap.totalEstimatedHours is not a valid numeric range.");
  }

  const taskIds = new Set(roadmap.tasks.map((t) => t.id));
  const phaseIds = new Set(roadmap.phases.map((p) => p.id));
  const seenOrders = new Set<number>();

  for (const phase of roadmap.phases) {
    if (seenOrders.has(phase.order)) {
      problems.push(`Duplicate phase order ${phase.order} on phase "${phase.title}".`);
    }
    seenOrders.add(phase.order);

    for (const taskId of phase.taskIds) {
      if (!taskIds.has(taskId)) {
        problems.push(`Phase "${phase.title}" references missing task id ${taskId}.`);
      }
    }
  }

  for (const task of roadmap.tasks) {
    if (!isValidNumericRange(task.estimatedHours)) {
      problems.push(`Task "${task.title}" has an invalid estimatedHours range.`);
    }
    for (const dep of task.dependsOnTaskIds) {
      if (!taskIds.has(dep)) {
        problems.push(`Task "${task.title}" depends on missing task id ${dep}.`);
      }
      if (dep === task.id) {
        problems.push(`Task "${task.title}" cannot depend on itself.`);
      }
    }
  }

  const cycle = findDependencyCycle(roadmap.tasks);
  if (cycle.length > 0) {
    problems.push(`Circular task dependency detected: ${cycle.join(" -> ")}.`);
  }

  for (const milestone of roadmap.milestones) {
    if (!phaseIds.has(milestone.phaseId)) {
      problems.push(`Milestone "${milestone.title}" references missing phase id ${milestone.phaseId}.`);
    }
    // Not enforced as a blocking problem: acceptanceCriteria is valuable
    // supplementary detail, but empirically Gemini omits it for some
    // milestones even after a corrective retry that explicitly lists which
    // milestones need it (see roadmap.service.ts's parseMilestone comment).
    // With a bounded retry budget, treating this as fatal means a handful
    // of missing bullet points can repeatedly sink an otherwise-complete,
    // fully real roadmap. An empty list is visible and honest — the
    // student can still see and use every phase/task/milestone — whereas
    // failing the whole generation over it is a worse outcome for them.
  }

  for (const entry of roadmap.timeline) {
    if (!phaseIds.has(entry.phaseId)) {
      problems.push(`Timeline entry references missing phase id ${entry.phaseId}.`);
    }
    if (entry.endWeek < entry.startWeek) {
      problems.push(`Timeline entry for phase ${entry.phaseId} has endWeek before startWeek.`);
    }
  }

  return problems;
}
