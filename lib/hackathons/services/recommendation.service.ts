/**
 * recommendation.service.ts
 * AI Hackathon Recommendations: takes the deterministic top-ranked
 * hackathons and asks AI Core for a short rationale per recommendation,
 * grounded in the actual match score data (not free-floating opinion).
 */

import { HackathonUserProfile, HackathonRecommendation, ServiceResult, success, failure } from "../models/hackathon.model";
import { AiCoreClient } from "../providers/ai-core.provider";
import { RankingService } from "./ranking.service";
import { processRecommendations } from "../recommendation/recommendation-postprocess";
import { sanitizeForPrompt } from "../utils/security";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

export class RecommendationService {
  constructor(
    private readonly rankingService: RankingService,
    private readonly aiCore?: AiCoreClient
  ) {}

  /**
   * Returns top-N recommendations. Rationale is AI-generated when AI Core
   * is available; otherwise a deterministic rationale is built from the
   * match score breakdown so recommendations always have an explanation.
   */
  async getRecommendations(profile: HackathonUserProfile, limit = 8): Promise<ServiceResult<HackathonRecommendation[]>> {
    const rankedPage = await this.rankingService.getPersonalizedRanking(profile, undefined, limit * 2);
    if (!rankedPage.ok || !rankedPage.data) {
      return failure("RANKING_FAILED", "Could not compute personalized ranking.");
    }

    const topRanked = rankedPage.data.items.slice(0, limit);

    const recommendations: HackathonRecommendation[] = await Promise.all(
      topRanked.map(async ({ hackathon, matchScore }) => ({
        hackathonId: hackathon.id,
        title: hackathon.title,
        rationale: await this.buildRationale(hackathon.title, matchScore, profile),
        confidenceScore: matchScore.overallMatchPercent,
        matchScore,
      }))
    );

    return success(processRecommendations(recommendations, limit));
  }

  private async buildRationale(
    hackathonTitle: string,
    matchScore: HackathonRecommendation["matchScore"],
    profile: HackathonUserProfile
  ): Promise<string> {
    const deterministicRationale = `${matchScore.overallMatchPercent}% match — skills ${matchScore.skillMatchPercent}%, theme ${matchScore.themeMatchPercent}%, difficulty fit ${matchScore.difficultyFitPercent}%.${
      matchScore.eligibilityOk ? "" : ` Note: ${matchScore.eligibilityNotes.join(" ")}`
    }`;

    if (!this.aiCore) return deterministicRationale;

    try {
      const prompt = `Given this hackathon match data, write one concise sentence (under 30 words) explaining why this hackathon is a good fit for the participant, in plain encouraging language.

Hackathon: ${sanitizeForPrompt(hackathonTitle)}
Match data: ${JSON.stringify(matchScore)}
Participant experience tier: ${profile.experienceTier}`;

      const response = await withRetry(() =>
        this.aiCore!.generateText({ taskId: "hackathon.recommendation_rationale", userId: profile.userId, prompt, temperature: 0.5, maxOutputTokens: 100 })
      );
      return response.text.trim();
    } catch (error) {
      logger.warn("AI rationale generation failed, using deterministic rationale", { error: (error as Error).message });
      return deterministicRationale;
    }
  }
}
