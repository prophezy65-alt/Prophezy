/**
 * roadmap.service.ts
 * Generates personalized learning roadmaps (and semester plans built on
 * top of them) via AI Core, with a deterministic static fallback so the
 * feature degrades gracefully rather than failing outright.
 */

import {
  StudentCareerProfile,
  LearningRoadmap,
  SemesterPlan,
  ServiceResult,
  success,
} from "../models/career.model";
import { learningRoadmapAiSchema, validate } from "../validation/career.validation";
import { AiCoreClient } from "../providers/ai-core.provider";
import { CacheProvider, buildCacheKey } from "../providers/cache.provider";
import { buildRoadmapPrompt, buildInterviewPrepPlanPrompt } from "../prompts/career-prompts";
import { buildLearningRoadmap, mergeWithFallback, splitRoadmapIntoSemesters } from "../utils/roadmap-generator";
import { findFallbackRoadmap } from "../roadmaps/roadmap-templates";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

const ROADMAP_CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours

export class RoadmapService {
  constructor(
    private readonly aiCore: AiCoreClient,
    private readonly cache?: CacheProvider
  ) {}

  async generateRoadmap(
    profile: StudentCareerProfile,
    targetRole: string,
    weeksAvailable?: number
  ): Promise<ServiceResult<LearningRoadmap>> {
    const cacheKey = buildCacheKey("roadmap", profile.userId, targetRole.toLowerCase());
    if (this.cache) {
      const cached = await this.cache.get<LearningRoadmap>(cacheKey);
      if (cached) return success(cached);
    }

    const aiMilestones = await this.tryGenerateAiMilestones(
      buildRoadmapPrompt(profile, targetRole, weeksAvailable)
    );

    const fallback = findFallbackRoadmap(targetRole) ?? [];
    const finalMilestones = mergeWithFallback(aiMilestones, fallback);

    const roadmap = buildLearningRoadmap(profile.userId, targetRole, finalMilestones);

    if (this.cache) {
      await this.cache.set(cacheKey, roadmap, ROADMAP_CACHE_TTL_SECONDS);
    }

    return success(roadmap);
  }

  async generateInterviewPrepPlan(
    profile: StudentCareerProfile,
    targetRole: string
  ): Promise<ServiceResult<LearningRoadmap>> {
    const aiMilestones = await this.tryGenerateAiMilestones(buildInterviewPrepPlanPrompt(profile, targetRole));
    const fallback = findFallbackRoadmap(targetRole) ?? [];
    const finalMilestones = mergeWithFallback(aiMilestones, fallback);
    return success(buildLearningRoadmap(profile.userId, `Interview Prep: ${targetRole}`, finalMilestones));
  }

  /**
   * Splits an existing roadmap into semester-sized chunks for the
   * "Semester Planning" feature — no additional AI call needed, this is a
   * deterministic transform of already-generated milestones.
   */
  buildSemesterPlan(roadmap: LearningRoadmap, weeksPerSemester = 16): SemesterPlan[] {
    const chunks = splitRoadmapIntoSemesters(roadmap.milestones, weeksPerSemester);

    return chunks.map((milestones, index) => ({
      semesterLabel: `Semester ${index + 1}`,
      focusAreas: milestones.map((m) => m.title),
      suggestedCourses: milestones.flatMap((m) => m.recommendedResources),
      suggestedProjects: [],
      targetSkills: [...new Set(milestones.flatMap((m) => m.skillsCovered))],
    }));
  }

  private async tryGenerateAiMilestones(prompt: string) {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "career.roadmap",
          prompt,
          temperature: 0.5,
          maxOutputTokens: 2000,
        })
      );

      const validation = validate(learningRoadmapAiSchema, raw);
      if (!validation.success) {
        logger.warn("AI Core roadmap response failed validation, using fallback", { errors: validation.errors });
        return null;
      }
      return validation.data.milestones;
    } catch (error) {
      logger.warn("AI Core roadmap call failed, using fallback template", { error: (error as Error).message });
      return null;
    }
  }
}
