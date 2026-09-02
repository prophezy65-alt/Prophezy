/**
 * timeline-builder.ts
 * Normalizes milestone ordering and computes total estimated hours for a
 * PreparationTimeline — the planner equivalent of Career Guidance's
 * roadmap-generator.ts.
 */

import { PlannerMilestone, PreparationTimeline, HackathonId } from "../models/hackathon.model";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeMilestones(milestones: PlannerMilestone[]): PlannerMilestone[] {
  return [...milestones]
    .sort((a, b) => a.order - b.order)
    .map((m, index) => ({ ...m, id: m.id || generateId("milestone"), order: index }));
}

export function buildPreparationTimeline(hackathonId: HackathonId, milestones: PlannerMilestone[]): PreparationTimeline {
  const normalized = normalizeMilestones(milestones);
  const totalEstimatedHours = normalized.reduce((sum, m) => sum + m.estimatedHours, 0);
  return { hackathonId, milestones: normalized, totalEstimatedHours };
}
