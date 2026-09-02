/**
 * planner.service.ts
 * "Preparation Timeline", "Task Planner", "Milestone Planner", and
 * checklist generation. AI Core personalizes the plan; a deterministic
 * static template (scaled to available hours) is the fallback.
 */

import {
  Hackathon,
  HackathonUserProfile,
  PreparationTimeline,
  Checklist,
  ServiceResult,
  success,
} from "../models/hackathon.model";
import { preparationTimelineAiSchema, checklistItemsAiSchema, validate } from "../validation/hackathon.validation";
import { AiCoreClient } from "../providers/ai-core.provider";
import { buildPreparationTimelinePrompt, buildChecklistItemsPrompt } from "../prompts/hackathon-prompts";
import { FALLBACK_PREP_MILESTONES, scaleMilestonesToHours } from "../planner/milestone-templates";
import { normalizeMilestones, buildPreparationTimeline } from "../planner/timeline-builder";
import { buildBaselineChecklist } from "../utils/checklist-generator";
import { hoursUntil } from "../utils/timeline-calculator";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

export class PlannerService {
  constructor(private readonly aiCore: AiCoreClient) {}

  async generatePreparationTimeline(
    hackathon: Hackathon,
    profile: HackathonUserProfile
  ): Promise<ServiceResult<PreparationTimeline>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "hackathon.preparation_timeline",
          prompt: buildPreparationTimelinePrompt(hackathon, profile),
          temperature: 0.5,
          maxOutputTokens: 1500,
        })
      );

      const validation = validate(preparationTimelineAiSchema, raw);
      if (validation.success) {
        return success(buildPreparationTimeline(hackathon.id, normalizeMilestones(validation.data.milestones)));
      }
      logger.warn("Preparation timeline AI response failed validation, using fallback", { errors: validation.errors });
    } catch (error) {
      logger.warn("Preparation timeline AI call failed, using fallback", { error: (error as Error).message });
    }

    const hoursRemaining = Math.max(8, hoursUntil(hackathon.timeline.submissionDeadline));
    const weeklyHours = profile.availableHoursPerWeek ?? 10;
    const hoursBudget = Math.min(hoursRemaining, (weeklyHours / (24 * 7)) * hoursRemaining * 3);
    const scaled = scaleMilestonesToHours(FALLBACK_PREP_MILESTONES, Math.max(20, Math.round(hoursBudget)));

    return success(buildPreparationTimeline(hackathon.id, scaled));
  }

  async buildChecklist(hackathon: Hackathon): Promise<ServiceResult<Checklist>> {
    const baseline = buildBaselineChecklist(hackathon.id);

    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "hackathon.checklist_items",
          prompt: buildChecklistItemsPrompt(hackathon),
          temperature: 0.4,
          maxOutputTokens: 500,
        })
      );

      const validation = validate(checklistItemsAiSchema, raw);
      if (validation.success) {
        const extraItems = validation.data.items.map((i) => ({ ...i, done: false }));
        return success({ hackathonId: hackathon.id, items: [...baseline.items, ...extraItems] });
      }
      logger.warn("Checklist AI response failed validation, using baseline only", { errors: validation.errors });
    } catch (error) {
      logger.warn("Checklist AI call failed, using baseline only", { error: (error as Error).message });
    }

    return success(baseline);
  }
}
