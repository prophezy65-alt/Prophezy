/**
 * resume-analysis.service.ts
 * Career-context resume analysis: how well the resume aligns with the
 * student's stated career goals. This is distinct from — and reuses
 * rather than duplicates — Resume Studio's ATS engine; the `atsScore`
 * comes in via the profile (sourced from ResumeStudioProvider) and is
 * treated as the `resumeStrength` input here.
 */

import { StudentCareerProfile, ResumeCareerAnalysis, ServiceResult, success, failure } from "../models/career.model";
import { resumeCareerAnalysisSchema, validate } from "../validation/career.validation";
import { AiCoreClient } from "../providers/ai-core.provider";
import { buildResumeCareerAnalysisPrompt } from "../prompts/career-prompts";
import { computeDeterministicResumeSignal } from "../utils/resume-analyzer";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

export class ResumeAnalysisService {
  constructor(private readonly aiCore: AiCoreClient) {}

  async analyze(profile: StudentCareerProfile): Promise<ServiceResult<ResumeCareerAnalysis>> {
    if (!profile.resumeSummary?.trim()) {
      return failure("NO_RESUME", "No resume found for this student. Import or create one in Resume Studio first.");
    }

    const deterministicSignal = computeDeterministicResumeSignal(profile);

    try {
      const prompt = buildResumeCareerAnalysisPrompt(profile);
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "career.resume_analysis",
          prompt,
          temperature: 0.4,
          maxOutputTokens: 900,
        })
      );

      const validation = validate(resumeCareerAnalysisSchema, raw);
      if (!validation.success) {
        return success(this.deterministicFallback(deterministicSignal));
      }

      return success(validation.data);
    } catch (error) {
      logger.warn("Resume career analysis AI call failed, using deterministic fallback", {
        error: (error as Error).message,
      });
      return success(this.deterministicFallback(deterministicSignal));
    }
  }

  private deterministicFallback(
    signal: ReturnType<typeof computeDeterministicResumeSignal>
  ): ResumeCareerAnalysis {
    return {
      resumeStrengthScore: signal.hasResume ? 50 : 0,
      alignmentWithGoalsPercent: signal.goalAlignmentHintPercent,
      strengths: signal.hasResume ? ["Resume on file"] : [],
      gaps: [
        ...(signal.hasGithub ? [] : ["No GitHub link found — add one to strengthen technical credibility."]),
        ...(signal.hasLinkedin ? [] : ["No LinkedIn link found — add one for recruiter visibility."]),
      ],
      suggestedProjectsToAdd: [],
      suggestedSkillsToHighlight: [],
    };
  }
}
