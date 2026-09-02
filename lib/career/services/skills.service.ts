/**
 * skills.service.ts
 * Skill gap analysis for a target role: combines the deterministic
 * `matchSkillsToRole` signal with an AI Core call for qualitative
 * reasoning (why a gap matters, priority, proficiency estimate).
 */

import { StudentCareerProfile, SkillGapAnalysis, ServiceResult, success, failure } from "../models/career.model";
import { skillGapAnalysisSchema, validate } from "../validation/career.validation";
import { AiCoreClient, AiCoreError } from "../providers/ai-core.provider";
import { buildSkillGapPrompt } from "../prompts/career-prompts";
import { calculateSkillScore, matchSkillsToRole } from "../utils/skill-analyzer";
import { findRoleByTitle } from "../recommendations/catalog";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

export class SkillsService {
  constructor(private readonly aiCore: AiCoreClient) {}

  /**
   * Full skill gap analysis: prefers AI Core's qualitative output, but
   * falls back to a deterministic result (from the static catalog) if the
   * AI call fails, so the feature never fully breaks.
   */
  async analyzeSkillGap(profile: StudentCareerProfile, targetRole: string): Promise<ServiceResult<SkillGapAnalysis>> {
    try {
      const prompt = buildSkillGapPrompt(profile, targetRole);
      const raw = await withRetry(
        () =>
          this.aiCore.generateJson<unknown>({
            taskId: "career.skill_gap",
            prompt,
            temperature: 0.4,
            maxOutputTokens: 1200,
          }),
        { shouldRetry: (err) => !(err instanceof AiCoreError) || true }
      );

      const validation = validate(skillGapAnalysisSchema, raw);
      if (!validation.success) {
        logger.warn("AI Core skill gap response failed validation, falling back", { errors: validation.errors });
        return success(this.deterministicFallback(profile, targetRole));
      }

      return success(validation.data);
    } catch (error) {
      logger.warn("AI Core skill gap call failed, using deterministic fallback", {
        error: (error as Error).message,
      });
      return success(this.deterministicFallback(profile, targetRole));
    }
  }

  getSkillScore(profile: StudentCareerProfile): number {
    return calculateSkillScore(profile.skills);
  }

  /**
   * Deterministic fallback using the static role catalog — no AI required.
   * Used when AI Core is unavailable or returns an invalid response.
   */
  private deterministicFallback(profile: StudentCareerProfile, targetRole: string): SkillGapAnalysis {
    const role = findRoleByTitle(targetRole);
    if (!role) {
      return {
        targetRole,
        matchedSkills: [],
        gaps: [],
        overallReadinessPercent: 0,
      };
    }

    const match = matchSkillsToRole(profile.skills, role);
    return {
      targetRole: role.title,
      matchedSkills: match.matchedSkills,
      gaps: match.missingSkills.map((skill) => ({
        skill,
        currentProficiency: "none" as const,
        requiredProficiency: role.coreSkills.includes(skill) ? ("intermediate" as const) : ("beginner" as const),
        priority: role.coreSkills.includes(skill) ? ("high" as const) : ("low" as const),
        reason: role.coreSkills.includes(skill)
          ? `${skill} is a core requirement for ${role.title}.`
          : `${skill} is a nice-to-have for ${role.title}.`,
      })),
      overallReadinessPercent: match.matchPercent,
    };
  }
}
