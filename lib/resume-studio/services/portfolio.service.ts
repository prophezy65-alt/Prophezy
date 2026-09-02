/**
 * portfolio.service.ts
 * Generates a short portfolio-website bio from resume content.
 */

import { Resume, ServiceResult, success, failure } from "../models/resume.model";
import { flattenResumeText } from "../utils/resume-keywords";
import { generateContent } from "./generator.service";

export interface PortfolioBioResult {
  bio: string;
  wordCount: number;
}

export async function generatePortfolioBio(
  resume: Resume,
  targetRole?: string
): Promise<ServiceResult<PortfolioBioResult>> {
  const resumeSummary = flattenResumeText(resume.content).slice(0, 3000);

  const result = await generateContent({
    task: "generate_portfolio_bio",
    input: resumeSummary,
    context: { targetRole, tone: "professional" },
  });

  if (!result.ok || !result.data) {
    return failure("GENERATION_FAILED", result.error?.message ?? "Failed to generate portfolio bio.");
  }

  const bio = result.data.output.trim();
  return success<PortfolioBioResult>({
    bio,
    wordCount: bio.split(/\s+/).filter(Boolean).length,
  });
}
