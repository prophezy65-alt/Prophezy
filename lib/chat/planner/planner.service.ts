/**
 * lib/chat/planner/planner.service.ts
 *
 * Turns a multi-module IntentClassification into an ordered ExecutionPlan.
 * Ordering follows a static dependency hint map matching the mission
 * spec's own example flows (e.g. "exam tomorrow" -> syllabus before notes
 * before flashcards/quiz) rather than trying to infer dependencies from
 * the AI's module list order, which isn't a reliable signal on its own.
 */

import { randomUUID } from "crypto";
import type { ChatModuleId, ExecutionPlan, IntentClassification, PlanStep } from "../types/chat.types";
import { actionableModules } from "../intent/intent.service";

/**
 * module -> modules it should run AFTER, if both are present in the same
 * plan. Not a strict requirement graph (a plan can contain just one of
 * these modules and skip the rest) — only enforced pairwise when both
 * modules are actually present.
 */
const DEPENDENCY_HINTS: Partial<Record<ChatModuleId, ChatModuleId[]>> = {
  // "I have an exam tomorrow" -> syllabus_ai, notes_ai, flashcards_ai, quiz_ai
  notes_ai: ["syllabus_ai", "document_intelligence_engine"],
  flashcards_ai: ["notes_ai", "syllabus_ai"],
  quiz_ai: ["notes_ai", "syllabus_ai", "document_intelligence_engine"],

  // "I need an internship" -> internship_discovery_ai, career_guidance_ai, resume_studio
  internship_discovery_ai: ["career_guidance_ai", "resume_studio"],

  // "I uploaded a research paper" -> document_engine, research_ai, notes_ai, quiz_ai
  research_ai: ["document_intelligence_engine"],

  // "I want a hackathon project" -> hackathon_ai, project_generator, research_ai
  project_generator: ["hackathon_ai", "research_ai"],
};

export function buildExecutionPlan(sessionId: string, intent: IntentClassification): ExecutionPlan {
  const modules = actionableModules(intent).map((m) => m.module);
  const ordered = topologicalOrder(modules);

  const steps: PlanStep[] = ordered.map((module) => {
    const id = randomUUID();
    return {
      id,
      module,
      description: `${humanizeModuleName(module)}: ${intent.userGoalSummary}`,
      dependsOn: [], // resolved below once every step has an id
      params: { entities: intent.entities },
      status: "pending",
    };
  });

  // Resolve dependsOn now that every step has an id: a step depends on any
  // earlier step (in the topological order) whose module it's hinted to
  // follow AND that's actually present in this plan.
  const idByModule = new Map(steps.map((s) => [s.module, s.id]));
  for (const step of steps) {
    const mustFollow = DEPENDENCY_HINTS[step.module] ?? [];
    step.dependsOn = mustFollow.map((m) => idByModule.get(m)).filter((id): id is string => !!id);
  }

  return { id: randomUUID(), sessionId, steps, createdAt: new Date().toISOString() };
}

/** Orders modules so that any module with a dependency hint on another present module comes after it. Stable otherwise (preserves the AI's relevance ordering). */
function topologicalOrder(modules: ChatModuleId[]): ChatModuleId[] {
  const present = new Set(modules);
  const result: ChatModuleId[] = [];
  const visited = new Set<ChatModuleId>();

  function visit(module: ChatModuleId) {
    if (visited.has(module)) return;
    visited.add(module);
    const deps = (DEPENDENCY_HINTS[module] ?? []).filter((d) => present.has(d));
    for (const dep of deps) visit(dep);
    result.push(module);
  }

  for (const moduleId of modules) visit(moduleId);
  return result;
}

/** Steps ready to run right now: pending, with every dependency already completed. */
export function readySteps(plan: ExecutionPlan): PlanStep[] {
  const completedIds = new Set(plan.steps.filter((s) => s.status === "completed").map((s) => s.id));
  return plan.steps.filter((s) => s.status === "pending" && s.dependsOn.every((d) => completedIds.has(d)));
}

export function isPlanComplete(plan: ExecutionPlan): boolean {
  return plan.steps.every((s) => s.status === "completed" || s.status === "failed" || s.status === "skipped");
}

function humanizeModuleName(module: ChatModuleId): string {
  return module
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}
