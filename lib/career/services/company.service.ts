/**
 * company.service.ts
 * Company recommendation and lookup, blending the deterministic catalog
 * match score with AI Core's qualitative "company" recommendation type.
 */

import { StudentCareerProfile, Company, ServiceResult, success, failure } from "../models/career.model";
import { COMPANY_CATALOG, findCompanyByName } from "../recommendations/catalog";
import { ROLE_CATALOG } from "../recommendations/catalog";
import { calculateCompanyMatchPercent } from "../utils/career-matcher";
import { RecommendationService } from "./recommendation.service";

export interface CompanyMatchResult {
  company: Company;
  matchPercent: number;
}

export class CompanyService {
  constructor(private readonly recommendationService: RecommendationService) {}

  listTopMatches(profile: StudentCareerProfile, limit = 5): CompanyMatchResult[] {
    return COMPANY_CATALOG.map((company) => ({
      company,
      matchPercent: calculateCompanyMatchPercent(profile, company, ROLE_CATALOG),
    }))
      .sort((a, b) => b.matchPercent - a.matchPercent)
      .slice(0, limit);
  }

  getCompany(name: string): ServiceResult<Company> {
    const company = findCompanyByName(name);
    if (!company) return failure("NOT_FOUND", `Company "${name}" not found in catalog.`);
    return success(company);
  }

  /**
   * AI-enriched company recommendations (rationale, action items) —
   * delegates to RecommendationService rather than duplicating the AI Core
   * call, since "company" is one of the shared recommendation kinds.
   */
  async getAiCompanyRecommendations(profile: StudentCareerProfile, limit = 8) {
    return this.recommendationService.getRecommendations(profile, "company", limit);
  }
}
