/**
 * idea.service.ts
 * "Project Assistance" features: idea generation, architecture planning,
 * project complexity estimation, and learning resource recommendations.
 * Reuses Project Generator's idea pipeline as a building block where
 * possible rather than duplicating idea-generation logic wholesale.
 */

import {
  Hackathon,
  HackathonUserProfile,
  HackathonIdea,
  ArchitecturePlan,
  ProjectComplexityEstimate,
  LearningResource,
  ServiceResult,
  success,
  failure,
} from "../models/hackathon.model";
import {
  hackathonIdeaListSchema,
  architecturePlanSchema,
  projectComplexityEstimateSchema,
  learningResourceListSchema,
  validate,
} from "../validation/hackathon.validation";
import { AiCoreClient } from "../providers/ai-core.provider";
import {
  buildIdeaGenerationPrompt,
  buildArchitecturePlanPrompt,
  buildProjectComplexityPrompt,
  buildLearningResourcesPrompt,
} from "../prompts/hackathon-prompts";
import { ProjectGeneratorProvider } from "../providers/module-providers";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

export class IdeaService {
  constructor(
    private readonly aiCore: AiCoreClient,
    private readonly projectGenerator?: ProjectGeneratorProvider
  ) {}

  async generateIdeas(hackathon: Hackathon, profile: HackathonUserProfile, count = 3): Promise<ServiceResult<HackathonIdea[]>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "hackathon.idea_generation",
          prompt: buildIdeaGenerationPrompt(hackathon, profile, count),
          temperature: 0.8,
          maxOutputTokens: 1500,
        })
      );

      const validation = validate(hackathonIdeaListSchema, raw);
      if (!validation.success) {
        return failure("AI_VALIDATION_FAILED", "AI Core returned malformed hackathon ideas.", validation.errors);
      }

      return success(validation.data.ideas);
    } catch (error) {
      logger.error("Idea generation failed", { hackathonId: hackathon.id, error: (error as Error).message });
      return failure("IDEA_GENERATION_FAILED", "Failed to generate hackathon ideas.");
    }
  }

  async buildArchitecturePlan(idea: HackathonIdea): Promise<ServiceResult<ArchitecturePlan>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "hackathon.architecture_plan",
          prompt: buildArchitecturePlanPrompt(idea.title, idea.pitch, idea.techStackSuggestion),
          temperature: 0.4,
          maxOutputTokens: 900,
        })
      );

      const validation = validate(architecturePlanSchema, raw);
      if (!validation.success) {
        return failure("AI_VALIDATION_FAILED", "AI Core returned a malformed architecture plan.", validation.errors);
      }
      return success(validation.data);
    } catch (error) {
      logger.error("Architecture plan generation failed", { ideaId: idea.id, error: (error as Error).message });
      return failure("ARCHITECTURE_FAILED", "Failed to generate architecture plan.");
    }
  }

  async estimateComplexity(idea: HackathonIdea, hoursAvailable: number): Promise<ServiceResult<ProjectComplexityEstimate>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "hackathon.complexity_estimate",
          prompt: buildProjectComplexityPrompt(idea.title, idea.pitch, hoursAvailable),
          temperature: 0.3,
          maxOutputTokens: 400,
        })
      );

      const validation = validate(projectComplexityEstimateSchema, raw);
      if (!validation.success) {
        return failure("AI_VALIDATION_FAILED", "AI Core returned a malformed complexity estimate.", validation.errors);
      }
      return success(validation.data);
    } catch (error) {
      logger.error("Complexity estimation failed", { ideaId: idea.id, error: (error as Error).message });
      return failure("COMPLEXITY_ESTIMATION_FAILED", "Failed to estimate project complexity.");
    }
  }

  async recommendLearningResources(techStack: string[], experienceTier: string): Promise<ServiceResult<LearningResource[]>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "hackathon.learning_resources",
          prompt: buildLearningResourcesPrompt(techStack, experienceTier),
          temperature: 0.4,
          maxOutputTokens: 700,
        })
      );

      const validation = validate(learningResourceListSchema, raw);
      if (!validation.success) {
        return failure("AI_VALIDATION_FAILED", "AI Core returned malformed learning resources.", validation.errors);
      }
      return success(validation.data.resources);
    } catch (error) {
      logger.error("Learning resource recommendation failed", { error: (error as Error).message });
      return failure("LEARNING_RESOURCES_FAILED", "Failed to recommend learning resources.");
    }
  }

  /**
   * Delegates to Project Generator's existing idea pipeline for a single
   * quick idea, when the caller wants to reuse that module directly
   * instead of the hackathon-specific multi-idea generator above.
   */
  async generateIdeaViaProjectGenerator(promptText: string): Promise<ServiceResult<{ title: string; description: string }>> {
    if (!this.projectGenerator) {
      return failure("NOT_CONFIGURED", "ProjectGeneratorProvider was not injected into IdeaService.");
    }
    const result = await this.projectGenerator.generateProjectIdea(promptText);
    if (!result) return failure("GENERATION_FAILED", "Project Generator returned no idea.");
    return success(result);
  }
}
