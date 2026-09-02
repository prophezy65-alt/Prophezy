/**
 * recommendation.service.ts
 * Generates all recommendation types (career path, certification, course,
 * project, career switch, startup, freelance, remote) via AI Core, then
 * post-processes with the deterministic recommendation engine (dedupe,
 * clamp, rank).
 */

import { StudentCareerProfile, Recommendation, HigherStudiesGuidance, ServiceResult, success, failure } from "../models/career.model";
import {
  recommendationListSchema,
  higherStudiesGuidanceSchema,
  validate,
} from "../validation/career.validation";
import { AiCoreClient } from "../providers/ai-core.provider";
import { buildRecommendationPrompt, buildHigherStudiesPrompt } from "../prompts/career-prompts";
import { processRecommendations } from "../utils/recommendation-engine";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

type RecommendationKind = Parameters<typeof buildRecommendationPrompt>[1];

export class RecommendationService {
  constructor(private readonly aiCore: AiCoreClient) {}

  async getRecommendations(
    profile: StudentCareerProfile,
    kind: RecommendationKind,
    limit = 8
  ): Promise<ServiceResult<Recommendation[]>> {
    try {
      const prompt = buildRecommendationPrompt(profile, kind);
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: `career.recommendation.${kind}`,
          prompt,
          temperature: 0.6,
          maxOutputTokens: 4096,
        })
      );

      const validation = validate(recommendationListSchema, raw);
      if (!validation.success) {
        return failure("AI_VALIDATION_FAILED", "AI Core returned malformed recommendations.", validation.errors);
      }

      const processed = processRecommendations(validation.data.recommendations, limit);
      return success(processed);
    } catch (error) {
      logger.error("Recommendation generation failed", { kind, error: (error as Error).message });
      return failure("RECOMMENDATION_FAILED", `Failed to generate ${kind} recommendations.`);
    }
  }

  async getHigherStudiesGuidance(
    profile: StudentCareerProfile,
    program: "MBA" | "MS" | "PhD"
  ): Promise<ServiceResult<HigherStudiesGuidance>> {
    try {
      const prompt = buildHigherStudiesPrompt(profile, program);
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "career.higher_studies",
          prompt,
          temperature: 0.5,
          maxOutputTokens: 2048,
        })
      );

      const validation = validate(higherStudiesGuidanceSchema, raw);
      if (!validation.success) {
        return failure("AI_VALIDATION_FAILED", "AI Core returned malformed higher studies guidance.", validation.errors);
      }

      return success(validation.data);
    } catch (error) {
      logger.error("Higher studies guidance generation failed", { program, error: (error as Error).message });
      return failure("GUIDANCE_FAILED", `Failed to generate ${program} guidance.`);
    }
  }

  /**
   * Convenience method covering all three higher-studies programs the
   * student marked interest in, run concurrently.
   */
  async getAllHigherStudiesGuidance(
    profile: StudentCareerProfile
  ): Promise<ServiceResult<HigherStudiesGuidance[]>> {
    const programs = (profile.preferences.higherStudiesInterest ?? []).filter(
      (p): p is "MBA" | "MS" | "PhD" => p !== "none"
    );

    if (programs.length === 0) return success([]);

    const results = await Promise.all(programs.map((program) => this.getHigherStudiesGuidance(profile, program)));
    const succeeded = results.filter((r): r is { ok: true; data: HigherStudiesGuidance } => r.ok && !!r.data);

    return success(succeeded.map((r) => r.data));
  }
}
