/**
 * lib/project-generator/services/estimation.service.ts
 *
 * Computes a `ProjectEstimation` deterministically from an existing
 * `ProjectSpec` + `Roadmap` — no AI Core call needed here. Cost, effort,
 * and timeline figures are derived with transparent, auditable formulas
 * rather than an LLM guess, so the same spec+roadmap always produces the
 * same estimate and the numbers can be explained line by line.
 */

import {
  ComplexityFactor,
  CostBreakdownItem,
  EffortBreakdownItem,
  ProjectEstimation,
  ProjectScale,
  ProjectSpec,
  Result,
  GenerationError,
  Roadmap,
  ok,
  err,
  validateProjectEstimation,
} from "../models";
import { validationFailedError } from "./errors";
import type { ServiceContext } from "./types";

/** Blended fully-loaded hourly developer rate range used for cost derivation, in USD. */
const HOURLY_RATE_RANGE = { min: 35, max: 90 } as const;

const SCALE_MONTHLY_HOSTING_USD: Record<ProjectScale, { min: number; max: number }> = {
  [ProjectScale.PROTOTYPE]: { min: 0, max: 25 },
  [ProjectScale.MVP]: { min: 25, max: 150 },
  [ProjectScale.PRODUCTION]: { min: 150, max: 800 },
  [ProjectScale.ENTERPRISE]: { min: 800, max: 5000 },
};

const SCALE_TEAM_SIZE: Record<ProjectScale, { min: number; max: number }> = {
  [ProjectScale.PROTOTYPE]: { min: 1, max: 1 },
  [ProjectScale.MVP]: { min: 1, max: 3 },
  [ProjectScale.PRODUCTION]: { min: 2, max: 6 },
  [ProjectScale.ENTERPRISE]: { min: 5, max: 15 },
};

/** Weighted complexity factors derived from spec attributes. Weights must sum to 1.0. */
function buildComplexityFactors(spec: ProjectSpec, roadmap: Roadmap): ComplexityFactor[] {
  const moduleCountFactor = Math.min(1, spec.modules.length / 12);
  const externalIntegrationFactor = spec.techStack.filter((t) => t.category === "ai_provider" || t.category === "other").length > 0 ? 1 : 0.3;
  const taskDependencyFactor = Math.min(
    1,
    roadmap.tasks.reduce((sum, t) => sum + t.dependsOnTaskIds.length, 0) / Math.max(1, roadmap.tasks.length)
  );
  const scaleFactor = { prototype: 0.2, mvp: 0.45, production: 0.75, enterprise: 1 }[spec.scale];

  const rawFactors: { factor: string; raw: number; notes: string }[] = [
    { factor: "Module count", raw: moduleCountFactor, notes: `${spec.modules.length} modules across the spec.` },
    {
      factor: "External / AI integrations",
      raw: externalIntegrationFactor,
      notes: "Third-party or AI-provider dependencies add integration and failure-mode surface area.",
    },
    {
      factor: "Task interdependency",
      raw: taskDependencyFactor,
      notes: "Higher inter-task dependency density increases sequencing and coordination risk.",
    },
    { factor: "Target scale", raw: scaleFactor, notes: `Project targets "${spec.scale}" scale.` },
  ];

  const totalRaw = rawFactors.reduce((sum, f) => sum + f.raw, 0) || 1;
  return rawFactors.map((f) => ({ factor: f.factor, weight: f.raw / totalRaw, notes: f.notes }));
}

function buildEffortBreakdown(spec: ProjectSpec, roadmap: Roadmap): EffortBreakdownItem[] {
  return spec.modules.map((module) => {
    const moduleTasks = roadmap.tasks.filter((t) => t.moduleId === module.id);
    const min = moduleTasks.reduce((sum, t) => sum + t.estimatedHours.min, 0);
    const max = moduleTasks.reduce((sum, t) => sum + t.estimatedHours.max, 0);
    return { moduleId: module.id, moduleName: module.name, estimatedHours: { min, max } };
  });
}

function buildCostBreakdown(spec: ProjectSpec, totalHours: { min: number; max: number }): CostBreakdownItem[] {
  const hosting = SCALE_MONTHLY_HOSTING_USD[spec.scale];
  const aiUsageMonthly =
    spec.techStack.some((t) => t.category === "ai_provider") ? { min: 20, max: 500 } : { min: 0, max: 0 };

  return [
    {
      label: "Developer time (one-time build)",
      monthlyUsd: { min: 0, max: 0 },
      oneTimeUsd: {
        min: Math.round(totalHours.min * HOURLY_RATE_RANGE.min),
        max: Math.round(totalHours.max * HOURLY_RATE_RANGE.max),
      },
      notes: `Based on ${totalHours.min}-${totalHours.max} estimated hours at $${HOURLY_RATE_RANGE.min}-$${HOURLY_RATE_RANGE.max}/hr blended rate.`,
    },
    {
      label: "Hosting & infrastructure",
      monthlyUsd: hosting,
      oneTimeUsd: { min: 0, max: 0 },
      notes: `Estimated for "${spec.scale}" scale based on typical ${spec.techStack.find((t) => t.category === "hosting")?.name ?? "cloud"} pricing tiers.`,
    },
    {
      label: "AI API usage",
      monthlyUsd: aiUsageMonthly,
      oneTimeUsd: { min: 0, max: 0 },
      notes:
        aiUsageMonthly.max > 0
          ? "Scales with request volume and model tier; monitor via the AI Core's usage/cost logging."
          : "No AI provider detected in the tech stack.",
    },
  ];
}

function difficultyLabel(score: number): string {
  if (score < 25) return "Low";
  if (score < 50) return "Moderate";
  if (score < 75) return "High";
  return "Very High";
}

/**
 * Computes a `ProjectEstimation` from an existing `ProjectSpec` + `Roadmap`.
 * Purely deterministic — safe to call repeatedly and cheap enough that no
 * caching hook is needed here (unlike the AI-backed services).
 */
export async function generateEstimation(
  spec: ProjectSpec,
  roadmap: Roadmap,
  context: ServiceContext
): Promise<Result<ProjectEstimation, GenerationError>> {
  if (roadmap.projectSpecId !== spec.id) {
    return err(validationFailedError("generateEstimation", [`Roadmap.projectSpecId does not match ProjectSpec.id.`]));
  }

  const complexityFactors = buildComplexityFactors(spec, roadmap);
  const effortBreakdown = buildEffortBreakdown(spec, roadmap);
  const costBreakdown = buildCostBreakdown(spec, roadmap.totalEstimatedHours);
  const teamSize = SCALE_TEAM_SIZE[spec.scale];

  const oneTimeTotal = costBreakdown.reduce(
    (acc, item) => ({ min: acc.min + item.oneTimeUsd.min, max: acc.max + item.oneTimeUsd.max }),
    { min: 0, max: 0 }
  );

  // A rough 3-month runway of recurring costs is folded into the headline estimate
  // so the number reflects "cost to build and run for a quarter", not build-only.
  const recurringThreeMonths = costBreakdown.reduce(
    (acc, item) => ({ min: acc.min + item.monthlyUsd.min * 3, max: acc.max + item.monthlyUsd.max * 3 }),
    { min: 0, max: 0 }
  );

  const estimatedCostUsd = {
    min: oneTimeTotal.min + recurringThreeMonths.min,
    max: oneTimeTotal.max + recurringThreeMonths.max,
  };

  // Timeline assumes a team within the recommended team-size range works in parallel;
  // total hours are divided by an approximate team throughput (min team size, 30 productive hrs/week/person).
  const productiveHoursPerWeekPerPerson = 30;
  const timelineWeeksMin = Math.max(
    1,
    Math.ceil(roadmap.totalEstimatedHours.min / (teamSize.max * productiveHoursPerWeekPerPerson))
  );
  const timelineWeeksMax = Math.max(
    timelineWeeksMin,
    Math.ceil(roadmap.totalEstimatedHours.max / (teamSize.min * productiveHoursPerWeekPerPerson))
  );

  const estimation: ProjectEstimation = {
    id: context.ids.newId(),
    projectSpecId: spec.id,
    roadmapId: roadmap.id,
    difficulty: spec.difficulty,
    complexity: { ...spec.complexity, label: difficultyLabel(spec.complexity.score) },
    complexityFactors,
    totalEstimatedHours: roadmap.totalEstimatedHours,
    effortBreakdown,
    estimatedCostUsd,
    costBreakdown,
    recommendedTeamSize: teamSize,
    estimatedTimelineWeeks: { min: timelineWeeksMin, max: timelineWeeksMax },
  };

  const problems = validateProjectEstimation(estimation);
  if (problems.length > 0) {
    context.logger.error("generateEstimation: validation failed", { problems });
    return err(validationFailedError("generateEstimation", problems));
  }

  context.logger.info("generateEstimation: succeeded", {
    projectSpecId: spec.id,
    estimatedCostUsd,
    estimatedTimelineWeeks: estimation.estimatedTimelineWeeks,
  });
  return ok(estimation);
}
