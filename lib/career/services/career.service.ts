/**
 * career.service.ts
 * Central orchestration service. Assembles the aggregated
 * `StudentCareerProfile` by pulling summarized data from every existing
 * module (Resume Studio, Interview AI, Quiz AI, Flashcards, Notes,
 * Assignments, Research, Project Generator, Syllabus) through the
 * `CareerModuleProviders` interface — never re-implementing their logic.
 */

import {
  StudentCareerProfile,
  SkillEntry,
  ServiceResult,
  success,
  UserId,
} from "../models/career.model";
import { studentCareerProfileSchema, validate } from "../validation/career.validation";
import { CareerModuleProviders } from "../providers/module-providers";
import { CacheProvider, buildCacheKey } from "../providers/cache.provider";
import { AiCoreClient } from "../providers/ai-core.provider";
import { trimToCompleteSentence } from "../utils/text";
import { buildCareerAdvisorPrompt } from "../prompts/career-prompts";
import { mergeSkillSources } from "../utils/skill-analyzer";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import {
  spendCredits,
  refundCredits,
  getFeatureCreditCost,
  InsufficientCreditsError,
  CREDIT_FEATURES,
} from "@/lib/credits";

const PROFILE_CACHE_TTL_SECONDS = 60 * 15; // 15 minutes — profile aggregates change slowly

export class CareerService {
  constructor(
    private readonly providers: CareerModuleProviders,
    private readonly cache?: CacheProvider,
    private readonly aiCore?: AiCoreClient
  ) {}

  /**
   * "AI Career Advisor" — free-text Q&A grounded in the student's
   * aggregated profile. Not a general chatbot: the prompt explicitly
   * instructs the model to answer only from profile data or say it can't.
   *
   * CREDIT GATING (added): CAREER_GUIDANCE_AI (2 credits), spent BEFORE
   * the AI Core call. Uses profile.userId — already present on every
   * StudentCareerProfile (see buildProfile below), so no new parameter
   * was needed. Spend/refund are manual (not the spendCreditsForFeature
   * wrapper) because this method's own design never throws — every
   * failure path already returns { ok: false, error } — so a refund on
   * AI failure is added to the EXISTING catch block below rather than
   * introduced via try/catch machinery this file didn't already have.
   */
  async askAdvisor(profile: StudentCareerProfile, question: string): Promise<ServiceResult<string>> {
    if (!this.aiCore) {
      return { ok: false, error: { code: "AI_CORE_NOT_CONFIGURED", message: "AI Core client was not injected into CareerService." } };
    }
    if (!question?.trim()) {
      return { ok: false, error: { code: "INVALID_INPUT", message: "A question is required." } };
    }

    const feature = CREDIT_FEATURES.CAREER_GUIDANCE_AI;
    const cost = await getFeatureCreditCost(feature);
    if (!cost) {
      return {
        ok: false,
        error: { code: "CAREER_GUIDANCE_UNAVAILABLE", message: `Career Guidance AI is temporarily unavailable (no active credit cost configured for "${feature}").` },
      };
    }

    try {
      await spendCredits(cost.creditCost, feature, "Career guidance AI advisor question");
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      throw err;
    }

    try {
      const prompt = buildCareerAdvisorPrompt(profile, question);
      const response = await withRetry(() =>
        this.aiCore!.generateText({ taskId: "career.advisor", prompt, temperature: 0.5, maxOutputTokens: 2048 })
      );
      return success(trimToCompleteSentence(response.text));
    } catch (error) {
      logger.error("Career advisor call failed", { error: (error as Error).message });
      // The charge was already taken before this call — refund it since
      // no usable advisor response was produced.
      await refundCredits(profile.userId, cost.creditCost, feature, "Refund: career advisor call failed").catch(() => {});
      return { ok: false, error: { code: "ADVISOR_FAILED", message: "Failed to get advisor response." } };
    }
  }

  /**
   * Builds the full aggregated profile for a student by fanning out to
   * every reused module in parallel, then merging skill signals from all
   * sources. Individual provider failures are logged and treated as
   * "no data" rather than failing the whole profile build.
   */
  async buildProfile(
    userId: UserId,
    overrides?: Partial<Pick<StudentCareerProfile, "preferences" | "targetJobDescription" | "targetInternshipDescription">>
  ): Promise<ServiceResult<StudentCareerProfile>> {
    const cacheKey = buildCacheKey("career-profile", userId);
    if (this.cache) {
      const cached = await this.cache.get<StudentCareerProfile>(cacheKey);
      if (cached) return success(cached);
    }

    const [resume, interview, quiz, flashcards, notes, assignments, research, projects, syllabus] =
      await Promise.all([
        this.safeCall(() => this.providers.resumeStudio.getLatestResumeSummary(userId), "resumeStudio"),
        this.safeCall(() => this.providers.interviewAi.getPerformanceSummary(userId), "interviewAi"),
        this.safeCall(() => this.providers.quizAi.getPerformanceSummary(userId), "quizAi"),
        this.safeCall(() => this.providers.flashcardsAi.getAnalyticsSummary(userId), "flashcardsAi"),
        this.safeCall(() => this.providers.notesAi.getSummary(userId), "notesAi"),
        this.safeCall(() => this.providers.assignmentAi.getSummary(userId), "assignmentAi"),
        this.safeCall(() => this.providers.researchAi.getSummary(userId), "researchAi"),
        this.safeCall(() => this.providers.projectGenerator.getSummary(userId), "projectGenerator"),
        this.safeCall(() => this.providers.syllabusAi.getProgressSummary(userId), "syllabusAi"),
      ]);

    const resumeSkills: SkillEntry[] = (resume?.skills ?? []).map((name) => ({
      name,
      source: "resume" as const,
    }));
    const quizSkills: SkillEntry[] = (quiz?.strongTopics ?? []).map((name) => ({
      name,
      proficiency: "intermediate" as const,
      source: "quiz" as const,
    }));
    const flashcardSkills: SkillEntry[] = (flashcards?.topicsCovered ?? []).map((name) => ({
      name,
      source: "flashcards" as const,
    }));

    const mergedSkills = mergeSkillSources(resumeSkills, quizSkills, flashcardSkills);

    const profile: StudentCareerProfile = {
      userId,
      academic: {
        syllabusProgressPercent: syllabus?.progressPercent,
      },
      skills: mergedSkills,
      performance: {
        quizAverageScore: quiz?.averageScore,
        interviewAverageScore: interview?.averageScore,
        flashcardsRetentionRate: flashcards?.retentionRatePercent,
        assignmentsCompletionRate: assignments?.completionRatePercent,
        researchPapersCount: research?.papersCount,
        projectsCount: projects?.projectsCount,
      },
      preferences: overrides?.preferences ?? {},
      resumeSummary: resume?.resumeText,
      githubUrl: resume?.githubUrl,
      linkedinUrl: resume?.linkedinUrl,
      targetJobDescription: overrides?.targetJobDescription,
      targetInternshipDescription: overrides?.targetInternshipDescription,
      generatedAt: new Date().toISOString(),
    };

    const validation = validate(studentCareerProfileSchema, profile);
    if (!validation.success) {
      logger.warn("Assembled career profile failed validation", { userId, errors: validation.errors });
    }

    if (this.cache) {
      await this.cache.set(cacheKey, profile, PROFILE_CACHE_TTL_SECONDS);
    }

    return success(profile);
  }

  async invalidateProfileCache(userId: UserId): Promise<void> {
    if (!this.cache) return;
    await this.cache.invalidate(buildCacheKey("career-profile", userId));
  }

  private async safeCall<T>(fn: () => Promise<T | null>, providerName: string): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`Provider call failed, continuing without its data`, {
        provider: providerName,
        error: (error as Error).message,
      });
      return null;
    }
  }
}
