/**
 * lib/project-generator/models/estimation.model.ts
 *
 * Captures cost, effort, difficulty and complexity estimates derived
 * from a ProjectSpec + Roadmap pair. Kept as a distinct aggregate
 * (rather than folded into ProjectSpec) since estimation can be
 * re-run independently as a roadmap evolves.
 */

import { UUID, NumericRange, ScoreValue, isValidNumericRange, isValidScoreValue, isUUID } from "./shared.model";

export interface CostBreakdownItem {
  readonly label: string; // e.g. "Hosting (Vercel Pro)", "AI API usage", "Developer time"
  readonly monthlyUsd: NumericRange;
  readonly oneTimeUsd: NumericRange;
  readonly notes: string;
}

export interface EffortBreakdownItem {
  readonly moduleId: UUID;
  readonly moduleName: string;
  readonly estimatedHours: NumericRange;
}

export interface ComplexityFactor {
  readonly factor: string; // e.g. "Real-time collaboration", "Third-party AI integration"
  readonly weight: number; // 0-1, relative contribution to overall complexity
  readonly notes: string;
}

export interface ProjectEstimation {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly roadmapId: UUID;
  readonly difficulty: ScoreValue;
  readonly complexity: ScoreValue;
  readonly complexityFactors: readonly ComplexityFactor[];
  readonly totalEstimatedHours: NumericRange;
  readonly effortBreakdown: readonly EffortBreakdownItem[];
  readonly estimatedCostUsd: NumericRange;
  readonly costBreakdown: readonly CostBreakdownItem[];
  readonly recommendedTeamSize: NumericRange;
  readonly estimatedTimelineWeeks: NumericRange;
}

export function totalMonthlyRunningCost(estimation: ProjectEstimation): NumericRange {
  return estimation.costBreakdown.reduce<NumericRange>(
    (acc, item) => ({
      min: acc.min + item.monthlyUsd.min,
      max: acc.max + item.monthlyUsd.max,
    }),
    { min: 0, max: 0 }
  );
}

export function sumEffortHours(estimation: ProjectEstimation): NumericRange {
  return estimation.effortBreakdown.reduce<NumericRange>(
    (acc, item) => ({
      min: acc.min + item.estimatedHours.min,
      max: acc.max + item.estimatedHours.max,
    }),
    { min: 0, max: 0 }
  );
}

export function validateProjectEstimation(estimation: ProjectEstimation): string[] {
  const problems: string[] = [];

  if (!isUUID(estimation.id)) problems.push("ProjectEstimation.id must be a UUID.");
  if (!isUUID(estimation.projectSpecId)) problems.push("ProjectEstimation.projectSpecId must be a UUID.");
  if (!isUUID(estimation.roadmapId)) problems.push("ProjectEstimation.roadmapId must be a UUID.");

  if (!isValidScoreValue(estimation.difficulty)) problems.push("ProjectEstimation.difficulty is invalid.");
  if (!isValidScoreValue(estimation.complexity)) problems.push("ProjectEstimation.complexity is invalid.");
  if (!isValidNumericRange(estimation.totalEstimatedHours)) problems.push("totalEstimatedHours is not a valid range.");
  if (!isValidNumericRange(estimation.estimatedCostUsd)) problems.push("estimatedCostUsd is not a valid range.");
  if (!isValidNumericRange(estimation.recommendedTeamSize)) problems.push("recommendedTeamSize is not a valid range.");
  if (!isValidNumericRange(estimation.estimatedTimelineWeeks)) problems.push("estimatedTimelineWeeks is not a valid range.");

  const weightSum = estimation.complexityFactors.reduce((sum, f) => sum + f.weight, 0);
  if (estimation.complexityFactors.length > 0 && (weightSum < 0.99 || weightSum > 1.01)) {
    problems.push(`ComplexityFactor weights must sum to ~1.0 (got ${weightSum.toFixed(3)}).`);
  }

  for (const factor of estimation.complexityFactors) {
    if (factor.weight < 0 || factor.weight > 1) {
      problems.push(`ComplexityFactor "${factor.factor}" weight must be within 0-1.`);
    }
  }

  for (const item of estimation.effortBreakdown) {
    if (!isValidNumericRange(item.estimatedHours)) {
      problems.push(`EffortBreakdownItem "${item.moduleName}" has an invalid estimatedHours range.`);
    }
  }

  for (const item of estimation.costBreakdown) {
    if (!isValidNumericRange(item.monthlyUsd)) problems.push(`CostBreakdownItem "${item.label}" monthlyUsd is invalid.`);
    if (!isValidNumericRange(item.oneTimeUsd)) problems.push(`CostBreakdownItem "${item.label}" oneTimeUsd is invalid.`);
  }

  return problems;
}
