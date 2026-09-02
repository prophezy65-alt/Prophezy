/**
 * analysis.service.ts
 * "Smart Analysis" features: theme analysis, problem statement analysis,
 * difficulty estimation, and winning strategy — each combines an AI Core
 * call with a deterministic fallback so analysis is always available.
 */

import {
  Hackathon,
  HackathonUserProfile,
  ThemeAnalysis,
  ProblemStatementAnalysis,
  DifficultyEstimate,
  WinningStrategy,
  ServiceResult,
  success,
} from "../models/hackathon.model";
import {
  themeAnalysisSchema,
  problemStatementAnalysisSchema,
  difficultyEstimateSchema,
  winningStrategySchema,
  validate,
} from "../validation/hackathon.validation";
import { AiCoreClient } from "../providers/ai-core.provider";
import {
  buildThemeAnalysisPrompt,
  buildProblemStatementAnalysisPrompt,
  buildDifficultyEstimatePrompt,
  buildWinningStrategyPrompt,
} from "../prompts/hackathon-prompts";
import { extractThemeKeywords } from "../utils/theme-analyzer";
import { estimateDifficultyDeterministic } from "../utils/difficulty-calculator";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

export class AnalysisService {
  constructor(private readonly aiCore: AiCoreClient) {}

  async analyzeTheme(hackathon: Hackathon): Promise<ServiceResult<ThemeAnalysis>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({ taskId: "hackathon.theme_analysis", prompt: buildThemeAnalysisPrompt(hackathon), temperature: 0.5, maxOutputTokens: 500 })
      );
      const validation = validate(themeAnalysisSchema, raw);
      if (validation.success) return success(validation.data);
      logger.warn("Theme analysis AI response failed validation, using fallback", { errors: validation.errors });
    } catch (error) {
      logger.warn("Theme analysis AI call failed, using fallback", { error: (error as Error).message });
    }

    const keywords = extractThemeKeywords(hackathon);
    return success<ThemeAnalysis>({
      primaryThemes: hackathon.themes.length ? hackathon.themes : keywords.slice(0, 5),
      emergingTechnologyAngles: keywords,
      suggestedAngleForCandidate: `Consider combining ${keywords.slice(0, 2).join(" and ") || "the hackathon's stated themes"} for a distinctive angle.`,
    });
  }

  async analyzeProblemStatement(hackathon: Hackathon): Promise<ServiceResult<ProblemStatementAnalysis>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({ taskId: "hackathon.problem_analysis", prompt: buildProblemStatementAnalysisPrompt(hackathon), temperature: 0.5, maxOutputTokens: 600 })
      );
      const validation = validate(problemStatementAnalysisSchema, raw);
      if (validation.success) return success(validation.data);
      logger.warn("Problem statement analysis failed validation", { errors: validation.errors });
    } catch (error) {
      logger.warn("Problem statement analysis AI call failed", { error: (error as Error).message });
    }

    return success<ProblemStatementAnalysis>({
      coreProblem: hackathon.description.slice(0, 300),
      targetUsers: [],
      suggestedApproaches: [],
      commonPitfalls: [],
    });
  }

  async estimateDifficulty(hackathon: Hackathon): Promise<ServiceResult<DifficultyEstimate>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({ taskId: "hackathon.difficulty", prompt: buildDifficultyEstimatePrompt(hackathon), temperature: 0.3, maxOutputTokens: 250 })
      );
      const validation = validate(difficultyEstimateSchema, raw);
      if (validation.success) return success(validation.data);
    } catch (error) {
      logger.warn("Difficulty estimation AI call failed, using deterministic fallback", { error: (error as Error).message });
    }

    return success(estimateDifficultyDeterministic(hackathon));
  }

  async suggestWinningStrategy(
    hackathon: Hackathon,
    profile: HackathonUserProfile
  ): Promise<ServiceResult<WinningStrategy>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({ taskId: "hackathon.winning_strategy", prompt: buildWinningStrategyPrompt(hackathon, profile), temperature: 0.6, maxOutputTokens: 600 })
      );
      const validation = validate(winningStrategySchema, raw);
      if (validation.success) return success(validation.data);
      logger.warn("Winning strategy AI response failed validation", { errors: validation.errors });
    } catch (error) {
      logger.warn("Winning strategy AI call failed", { error: (error as Error).message });
    }

    return success<WinningStrategy>({
      keyDifferentiators: [],
      judgingFocusAreas: hackathon.evaluationCriteria ?? [],
      recommendedScopeForTimeAvailable: "Focus on a working end-to-end demo of one core feature rather than many partial features.",
      risksToAvoid: ["Over-scoping the project beyond what's demoable in the time available."],
    });
  }
}
