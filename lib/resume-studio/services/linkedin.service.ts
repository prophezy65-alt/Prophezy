/**
 * linkedin.service.ts
 * Generates a LinkedIn "About" section from resume content.
 */

import { Resume, ServiceResult, success, failure } from "../models/resume.model";
import { flattenResumeText } from "../utils/resume-keywords";
import { generateContent } from "./generator.service";

export interface LinkedInAboutResult {
  about: string;
  characterCount: number;
}

const LINKEDIN_ABOUT_MAX_CHARS = 2600;

export async function generateLinkedInAbout(
  resume: Resume,
  targetRole?: string
): Promise<ServiceResult<LinkedInAboutResult>> {
  const resumeSummary = flattenResumeText(resume.content).slice(0, 4000);

  const result = await generateContent({
    task: "generate_linkedin_about",
    input: resumeSummary,
    context: { targetRole, tone: "confident" },
  });

  if (!result.ok || !result.data) {
    return failure("GENERATION_FAILED", result.error?.message ?? "Failed to generate LinkedIn About section.");
  }

  let about = result.data.output;
  if (about.length > LINKEDIN_ABOUT_MAX_CHARS) {
    about = about.slice(0, LINKEDIN_ABOUT_MAX_CHARS - 1).trim() + "…";
  }

  return success<LinkedInAboutResult>({ about, characterCount: about.length });
}
