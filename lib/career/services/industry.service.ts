/**
 * industry.service.ts
 * Industry recommendation, lookup, and emerging-skills/trends surfacing.
 */

import { StudentCareerProfile, Industry, ServiceResult, success, failure } from "../models/career.model";
import { INDUSTRY_CATALOG, ROLE_CATALOG, findIndustryByName } from "../recommendations/catalog";
import { calculateIndustryMatchPercent } from "../utils/career-matcher";
import { RecommendationService } from "./recommendation.service";

export interface IndustryMatchResult {
  industry: Industry;
  matchPercent: number;
}

export class IndustryService {
  constructor(private readonly recommendationService: RecommendationService) {}

  listTopMatches(profile: StudentCareerProfile, limit = 5): IndustryMatchResult[] {
    return INDUSTRY_CATALOG.map((industry) => ({
      industry,
      matchPercent: calculateIndustryMatchPercent(profile, industry, ROLE_CATALOG),
    }))
      .sort((a, b) => b.matchPercent - a.matchPercent)
      .slice(0, limit);
  }

  getIndustry(name: string): ServiceResult<Industry> {
    const industry = findIndustryByName(name);
    if (!industry) return failure("NOT_FOUND", `Industry "${name}" not found in catalog.`);
    return success(industry);
  }

  /**
   * Returns emerging skills across all industries the student prefers (or
   * all industries if no preference set) — powers the "Emerging Skills"
   * and "Industry Trends" features without an AI call.
   */
  getEmergingSkills(profile: StudentCareerProfile): string[] {
    const preferred = profile.preferences.preferredIndustries;
    const relevant = preferred?.length
      ? INDUSTRY_CATALOG.filter((i) => preferred.some((p) => p.toLowerCase() === i.name.toLowerCase()))
      : INDUSTRY_CATALOG;

    const skills = new Set<string>();
    relevant.forEach((i) => i.emergingSkills.forEach((s) => skills.add(s)));
    return [...skills];
  }

  async getAiIndustryRecommendations(profile: StudentCareerProfile, limit = 8) {
    return this.recommendationService.getRecommendations(profile, "industry", limit);
  }
}
