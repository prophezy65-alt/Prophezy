/**
 * salary.service.ts
 * Salary estimation. The numeric range is always deterministic (see
 * `utils/salary-estimator.ts`) so it's never hallucinated; AI Core is only
 * used to generate optional plain-language commentary around the number.
 */

import { ExperienceLevel, SalaryEstimate, ServiceResult, success } from "../models/career.model";
import { estimateSalary } from "../utils/salary-estimator";
import { AiCoreClient } from "../providers/ai-core.provider";
import { sanitizeForPrompt } from "../utils/security";
import { logger } from "../utils/logger";
import { trimToCompleteSentence } from "../utils/text";

export class SalaryService {
  constructor(private readonly aiCore?: AiCoreClient) {}

  estimate(role: string, country: string, experienceLevel: ExperienceLevel, company?: string): ServiceResult<SalaryEstimate> {
    return success(estimateSalary(role, country, experienceLevel, company));
  }

  /**
   * Returns the deterministic estimate plus a short AI-generated
   * explanation of factors that could move the number up or down. Falls
   * back to the estimate alone (with no commentary) if AI Core fails or
   * isn't wired in.
   */
  async estimateWithCommentary(
    role: string,
    country: string,
    experienceLevel: ExperienceLevel,
    company?: string
  ): Promise<ServiceResult<SalaryEstimate & { commentary?: string }>> {
    const estimate = estimateSalary(role, country, experienceLevel, company);

    if (!this.aiCore) return success(estimate);

    try {
      const prompt = `You are a career salary advisor. Given this deterministic salary estimate, write exactly 1-2 short, complete sentences of plain-language commentary about what factors (skills, certifications, company reputation, negotiation) could move the candidate toward the top or bottom of the range. Do not restate the numbers. Keep it under 40 words total. Give one direct answer — no bracketed alternates, no hedging. Always finish your final sentence completely; never stop mid-word or mid-clause.

Role: ${sanitizeForPrompt(role)}
Country: ${sanitizeForPrompt(country)}
${company ? `Company: ${sanitizeForPrompt(company)}\n` : ""}Experience level: ${experienceLevel}
Range: ${estimate.currency} ${estimate.low}-${estimate.high}, median ${estimate.median}`;

      const response = await this.aiCore.generateText({
        taskId: "career.salary_commentary",
        prompt,
        temperature: 0.4,
        maxOutputTokens: 600,
      });

      return success({ ...estimate, commentary: trimToCompleteSentence(response.text) });
    } catch (error) {
      logger.warn("Salary commentary generation failed, returning estimate without commentary", {
        error: (error as Error).message,
      });
      return success(estimate);
    }
  }
}
