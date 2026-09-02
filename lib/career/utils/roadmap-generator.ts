/**
 * roadmap-generator.ts
 * Post-processes AI-generated roadmap milestones into a well-formed
 * LearningRoadmap: ensures ordering is contiguous, computes total weeks,
 * and can merge in a static fallback template when AI Core is unavailable.
 */

import { RoadmapMilestone, LearningRoadmap, UserId } from "../models/career.model";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Normalizes milestone ordering to be contiguous (0, 1, 2, ...) regardless
 * of what the AI returned, and ensures every milestone has an id.
 */
export function normalizeMilestones(milestones: RoadmapMilestone[]): RoadmapMilestone[] {
  return [...milestones]
    .sort((a, b) => a.order - b.order)
    .map((m, index) => ({
      ...m,
      id: m.id || generateId("milestone"),
      order: index,
    }));
}

export function buildLearningRoadmap(
  userId: UserId,
  targetRole: string,
  milestones: RoadmapMilestone[]
): LearningRoadmap {
  const normalized = normalizeMilestones(milestones);
  const totalEstimatedWeeks = normalized.reduce((sum, m) => sum + m.estimatedWeeks, 0);

  return {
    id: generateId("roadmap"),
    userId,
    targetRole,
    milestones: normalized,
    totalEstimatedWeeks,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Merges a fallback/static roadmap template with AI-personalized milestones,
 * preferring AI content but filling any gap (e.g. AI Core failure) with the
 * static template so the user is never left with zero guidance.
 */
export function mergeWithFallback(
  aiMilestones: RoadmapMilestone[] | null,
  fallbackMilestones: RoadmapMilestone[]
): RoadmapMilestone[] {
  if (aiMilestones && aiMilestones.length > 0) return aiMilestones;
  return fallbackMilestones;
}

/**
 * Splits a roadmap's milestones into semester-sized chunks based on a
 * given number of weeks per semester, useful for the Semester Planning
 * feature which reuses roadmap output.
 */
export function splitRoadmapIntoSemesters(
  milestones: RoadmapMilestone[],
  weeksPerSemester = 16
): RoadmapMilestone[][] {
  const semesters: RoadmapMilestone[][] = [];
  let current: RoadmapMilestone[] = [];
  let currentWeeks = 0;

  for (const milestone of normalizeMilestones(milestones)) {
    if (currentWeeks + milestone.estimatedWeeks > weeksPerSemester && current.length > 0) {
      semesters.push(current);
      current = [];
      currentWeeks = 0;
    }
    current.push(milestone);
    currentWeeks += milestone.estimatedWeeks;
  }

  if (current.length > 0) semesters.push(current);
  return semesters;
}
