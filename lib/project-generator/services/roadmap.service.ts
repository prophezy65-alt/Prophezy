/**
 * lib/project-generator/services/roadmap.service.ts
 *
 * Breaks a `ProjectSpec` into an executable `Roadmap`: phases, tasks
 * (with priority/difficulty/estimated hours/dependencies), milestones,
 * and a week-by-week timeline, via the AI Core.
 */

import {
  DifficultyLevel,
  ProjectSpec,
  Roadmap,
  RoadmapPhaseName,
  Result,
  GenerationError,
  ok,
  err,
  TaskPriority,
  validateRoadmap,
  findDependencyCycle,
} from "../models";
import { validationFailedError } from "./errors";
import { assertString, assertArray, assertObject, assertNumber, coerceEnum, coerceString } from "./parsing";
import type { ServiceContext } from "./types";

const FEATURE_KEY = "project-generator.roadmap";
const CACHE_TTL_SECONDS = 60 * 60;

const PHASE_NAME_VALUES = Object.values(RoadmapPhaseName);
const PRIORITY_VALUES = Object.values(TaskPriority);
const DIFFICULTY_VALUES = Object.values(DifficultyLevel);

interface RawTask {
  readonly key: string; // stable string key used to express dependencies before UUIDs exist
  readonly title: string;
  readonly description: string;
  readonly moduleName: string | null;
  readonly priority: string;
  readonly difficulty: string;
  readonly estimatedHoursMin: number;
  readonly estimatedHoursMax: number;
  readonly dependsOnTaskKeys: readonly string[];
}

interface RawPhase {
  readonly name: string;
  readonly title: string;
  readonly goal: string;
  readonly taskKeys: readonly string[];
  readonly order: number;
}

interface RawMilestone {
  readonly title: string;
  readonly description: string;
  readonly phaseName: string;
  readonly acceptanceCriteria: readonly string[];
}

interface RawTimelineEntry {
  readonly phaseName: string;
  readonly startWeek: number;
  readonly endWeek: number;
}

interface RawRoadmapResponse {
  readonly tasks: readonly RawTask[];
  readonly phases: readonly RawPhase[];
  readonly milestones: readonly RawMilestone[];
  readonly timeline: readonly RawTimelineEntry[];
}

function parseTask(raw: unknown, path: string): RawTask {
  const t = assertObject(raw, path);
  return {
    key: assertString(t.key, `${path}.key`),
    title: assertString(t.title, `${path}.title`),
    description: coerceString(t.description, "No description provided."),
    moduleName: t.moduleName ? assertString(t.moduleName, `${path}.moduleName`) : null,
    priority: assertString(t.priority, `${path}.priority`),
    difficulty: assertString(t.difficulty, `${path}.difficulty`),
    estimatedHoursMin: assertNumber(t.estimatedHoursMin, `${path}.estimatedHoursMin`),
    estimatedHoursMax: assertNumber(t.estimatedHoursMax, `${path}.estimatedHoursMax`),
    dependsOnTaskKeys: assertArray(t.dependsOnTaskKeys ?? [], `${path}.dependsOnTaskKeys`).map((k, i) =>
      assertString(k, `${path}.dependsOnTaskKeys[${i}]`)
    ),
  };
}

function parsePhase(raw: unknown, path: string, index: number): RawPhase {
  const p = assertObject(raw, path);
  // "order" is purely positional bookkeeping (the system prompt already
  // fixes phase ordering to phase_1..phase_4 in sequence) — it carries no
  // project content, so deriving it from the phase's array position when
  // the AI omits it is a structural default, not fabricated substance.
  // This matches the same self-healing pattern already used for enum
  // downgrades and dropped foreign keys elsewhere in this pipeline.
  const order = typeof p.order === "number" && Number.isFinite(p.order) ? p.order : index + 1;
  return {
    name: assertString(p.name, `${path}.name`),
    title: assertString(p.title, `${path}.title`),
    goal: assertString(p.goal, `${path}.goal`),
    taskKeys: assertArray(p.taskKeys, `${path}.taskKeys`).map((k, i) => assertString(k, `${path}.taskKeys[${i}]`)),
    order,
  };
}

function parseMilestone(raw: unknown, path: string): RawMilestone {
  const m = assertObject(raw, path);
  return {
    title: assertString(m.title, `${path}.title`),
    description: coerceString(m.description, "No description provided."),
    phaseName: assertString(m.phaseName, `${path}.phaseName`),
    // acceptanceCriteria is a supplementary list, not the milestone's
    // identity (title/phaseName are) — defaulting to an empty array when
    // the AI omits it keeps the milestone itself (real content) usable,
    // matching the same tolerance already given to dependsOnTaskKeys just
    // above, instead of discarding the whole 11-stage pipeline over one
    // missing sub-list.
    acceptanceCriteria: assertArray(m.acceptanceCriteria ?? [], `${path}.acceptanceCriteria`).map((c, i) =>
      assertString(c, `${path}.acceptanceCriteria[${i}]`)
    ),
  };
}

function parseTimelineEntry(raw: unknown, path: string): RawTimelineEntry | null {
  const e = assertObject(raw, path);
  // Unlike "order" (pure bookkeeping) or "acceptanceCriteria" (a droppable
  // supplementary list), startWeek/endWeek are genuine scheduling content —
  // there's no honest default to invent if the AI omits them, and doing so
  // would mean fabricating data rather than tolerating its absence. So
  // instead of defaulting the numbers (fake) or failing the whole roadmap
  // (previous behavior), we drop only this one timeline entry. The phases,
  // tasks and milestones it would have annotated are still fully real; the
  // roadmap is just missing one row of an optional schedule-overview table.
  const startWeek = e.startWeek;
  const endWeek = e.endWeek;
  if (typeof startWeek !== "number" || !Number.isFinite(startWeek) || typeof endWeek !== "number" || !Number.isFinite(endWeek)) {
    return null;
  }
  return {
    phaseName: assertString(e.phaseName, `${path}.phaseName`),
    startWeek,
    endWeek,
  };
}

function parseRawRoadmapResponse(raw: unknown): RawRoadmapResponse {
  const r = assertObject(raw, "$");
  const tasks = assertArray(r.tasks, "tasks").map((t, i) => parseTask(t, `tasks[${i}]`));
  const phases = assertArray(r.phases, "phases").map((p, i) => parsePhase(p, `phases[${i}]`, i));
  if (tasks.length === 0) throw new Error("tasks must contain at least one entry.");
  if (phases.length === 0) throw new Error("phases must contain at least one entry.");
  return {
    tasks,
    phases,
    milestones: assertArray(r.milestones ?? [], "milestones").map((m, i) => parseMilestone(m, `milestones[${i}]`)),
    timeline: assertArray(r.timeline ?? [], "timeline")
      .map((e, i) => parseTimelineEntry(e, `timeline[${i}]`))
      .filter((entry): entry is RawTimelineEntry => entry !== null),
  };
}

function buildSystemPrompt(): string {
  return [
    "You are the Roadmap generator inside Prophezy's Project Generator.",
    "Given a ProjectSpec, break it into an executable roadmap of phases, tasks, milestones and a timeline.",
    "",
    "Rules:",
    '- Use exactly 4 phases with \"name\" values \"phase_1\", \"phase_2\", \"phase_3\", \"phase_4\" in that order.',
    "- Every task needs a short unique \"key\" (e.g. \"setup-auth\", \"db-schema\") used to express dependencies and phase membership.",
    "- dependsOnTaskKeys must only reference other tasks' keys, must not be self-referential, and must not form a cycle.",
    "- priority MUST be one of: " + PRIORITY_VALUES.join(", ") + ".",
    "- difficulty MUST be one of: " + DIFFICULTY_VALUES.join(", ") + ".",
    "- estimatedHoursMin <= estimatedHoursMax for every task.",
    "- Every phase's taskKeys must reference tasks that actually exist.",
    "- Every milestone's phaseName must match one of the 4 phase names.",
    "",
    "Respond with ONLY a single JSON object (no prose, no Markdown fences) shaped as:",
    '{ "tasks": [...], "phases": [...], "milestones": [...], "timeline": [...] }',
  ].join("\n");
}

function buildUserPrompt(spec: ProjectSpec): string {
  const moduleList = spec.modules.map((m) => `- ${m.name}: ${m.description}`).join("\n");
  return [
    `Project: ${spec.title}`,
    spec.description,
    "",
    "Modules:",
    moduleList,
    "",
    `Difficulty: ${spec.difficulty.label} (${spec.difficulty.score}/100). Complexity: ${spec.complexity.label} (${spec.complexity.score}/100).`,
    `Scale: ${spec.scale}.`,
  ].join("\n");
}

export async function generateRoadmap(
  spec: ProjectSpec,
  context: ServiceContext
): Promise<Result<Roadmap, GenerationError>> {
  const aiResult = await context.aiCore.runStructured<Roadmap>({
    featureKey: FEATURE_KEY,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(spec),
    userId: spec.generationRequestId,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    // Many tasks x phases x milestones x timeline entries can exceed the
    // 8192-token default the same way database schema can.
    maxOutputTokens: 16384,
    parse: (raw) => {
      const parsed = parseRawRoadmapResponse(raw);

      const taskIdByKey = new Map<string, string>();
      for (const task of parsed.tasks) taskIdByKey.set(task.key, context.ids.newId());

      const tasks = parsed.tasks.map((t) => ({
        id: taskIdByKey.get(t.key) as string,
        title: t.title,
        description: t.description,
        moduleId: t.moduleName ? spec.modules.find((m) => m.name === t.moduleName)?.id ?? null : null,
        priority: coerceEnum(t.priority, PRIORITY_VALUES, TaskPriority.MEDIUM),
        difficulty: coerceEnum(t.difficulty, DIFFICULTY_VALUES, DifficultyLevel.INTERMEDIATE),
        estimatedHours: {
          min: Math.max(0, t.estimatedHoursMin),
          max: Math.max(Math.max(0, t.estimatedHoursMin), t.estimatedHoursMax),
        },
        dependsOnTaskIds: t.dependsOnTaskKeys
          .map((key) => taskIdByKey.get(key))
          .filter((id): id is string => Boolean(id)),
      }));

      // Break any accidental cycle the AI introduced by dropping the last dependency edge involved,
      // rather than failing the whole generation over a fixable inconsistency.
      let cycle = findDependencyCycle(tasks);
      let safetyCounter = 0;
      const mutableTasks = tasks.map((t) => ({ ...t, dependsOnTaskIds: [...t.dependsOnTaskIds] }));
      while (cycle.length > 1 && safetyCounter < 50) {
        const offendingTaskId = cycle[cycle.length - 2];
        const offendingTask = mutableTasks.find((t) => t.id === offendingTaskId);
        if (!offendingTask || offendingTask.dependsOnTaskIds.length === 0) break;
        offendingTask.dependsOnTaskIds.pop();
        cycle = findDependencyCycle(mutableTasks);
        safetyCounter += 1;
      }

      const phaseIdByName = new Map<string, string>();
      for (const phase of parsed.phases) phaseIdByName.set(phase.name, context.ids.newId());

      const phases = parsed.phases.map((p) => ({
        id: phaseIdByName.get(p.name) as string,
        name: coerceEnum(p.name, PHASE_NAME_VALUES, RoadmapPhaseName.PHASE_1),
        title: p.title,
        goal: p.goal,
        taskIds: p.taskKeys.map((key) => taskIdByKey.get(key)).filter((id): id is string => Boolean(id)),
        order: p.order,
      }));

      const milestones = parsed.milestones.map((m) => ({
        id: context.ids.newId(),
        title: m.title,
        description: m.description,
        phaseId: phaseIdByName.get(m.phaseName) ?? phases[0]!.id,
        acceptanceCriteria: m.acceptanceCriteria,
      }));

      const timeline = parsed.timeline.map((e) => ({
        phaseId: phaseIdByName.get(e.phaseName) ?? phases[0]!.id,
        startWeek: Math.max(1, Math.round(e.startWeek)),
        endWeek: Math.max(1, Math.round(e.endWeek)),
      }));

      const totalMin = mutableTasks.reduce((sum, t) => sum + t.estimatedHours.min, 0);
      const totalMax = mutableTasks.reduce((sum, t) => sum + t.estimatedHours.max, 0);

      const roadmap: Roadmap = {
        id: context.ids.newId(),
        projectSpecId: spec.id,
        phases,
        tasks: mutableTasks,
        milestones,
        timeline,
        totalEstimatedHours: { min: totalMin, max: totalMax },
      };

      // Validate INSIDE parse (not just after runStructured resolves) so a
      // semantically-invalid-but-well-formed response (e.g. a dangling
      // taskId reference) throws here and is caught by ai-core-client's
      // corrective-retry loop, instead of being a terminal failure with no
      // chance for the AI to fix it.
      const problems = validateRoadmap(roadmap);
      if (problems.length > 0) {
        throw new Error(problems.join(" "));
      }

      return roadmap;
    },
  });

  if (!aiResult.ok) return aiResult;

  const problems = validateRoadmap(aiResult.value);
  if (problems.length > 0) {
    context.logger.error("generateRoadmap: validation failed", { problems });
    return err(validationFailedError("generateRoadmap", problems));
  }

  context.logger.info("generateRoadmap: succeeded", {
    projectSpecId: spec.id,
    taskCount: aiResult.value.tasks.length,
    phaseCount: aiResult.value.phases.length,
  });
  return ok(aiResult.value);
}
