/**
 * milestone-templates.ts
 * Static fallback preparation timeline, used when AI Core is unavailable
 * or as an instant preview before the personalized AI timeline finishes
 * generating. Scaled by available hours in planner.service.ts.
 */

import { PlannerMilestone } from "../models/hackathon.model";

function milestone(id: string, title: string, description: string, order: number, estimatedHours: number): PlannerMilestone {
  return { id, title, description, order, estimatedHours };
}

export const FALLBACK_PREP_MILESTONES: PlannerMilestone[] = [
  milestone("prep-1", "Team formation & idea selection", "Form your team (or confirm solo), review the hackathon theme, and lock in one idea to pursue.", 0, 4),
  milestone("prep-2", "Scope definition", "Write a one-page scope doc: core features for an MVP vs. stretch goals.", 1, 2),
  milestone("prep-3", "Architecture & setup", "Set up repo, choose stack, scaffold frontend/backend, set up deployment pipeline early.", 2, 4),
  milestone("prep-4", "Core feature development", "Build the core features that make the demo work end-to-end.", 3, 16),
  milestone("prep-5", "Polish & edge cases", "Fix bugs, handle edge cases, improve UI polish.", 4, 6),
  milestone("prep-6", "Demo & pitch prep", "Record a backup demo video, write the pitch script, prepare slides.", 5, 4),
  milestone("prep-7", "Submission", "Fill out the submission form, double-check all links, submit before the deadline.", 6, 2),
];

/**
 * Scales the fallback template's hour estimates to fit a given total
 * hours budget (e.g. from `availableHoursPerWeek * weeksUntilDeadline`),
 * preserving relative proportions between milestones.
 */
export function scaleMilestonesToHours(milestones: PlannerMilestone[], totalHoursBudget: number): PlannerMilestone[] {
  const currentTotal = milestones.reduce((sum, m) => sum + m.estimatedHours, 0);
  if (currentTotal === 0) return milestones;

  const scaleFactor = totalHoursBudget / currentTotal;
  return milestones.map((m) => ({ ...m, estimatedHours: Math.max(1, Math.round(m.estimatedHours * scaleFactor)) }));
}
