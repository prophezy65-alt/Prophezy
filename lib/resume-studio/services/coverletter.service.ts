/**
 * coverletter.service.ts
 * Generates a tailored cover letter from resume content + job description.
 */

import { Resume, ServiceResult, success, failure } from "../models/resume.model";
import { flattenResumeText } from "../utils/resume-keywords";
import { generateContent } from "./generator.service";

export interface CoverLetterOptions {
  company: string;
  role: string;
  jobDescription: string;
  tone?: "professional" | "casual" | "confident" | "concise";
}

export interface CoverLetterResult {
  body: string;
  wordCount: number;
}

export async function generateCoverLetter(
  resume: Resume,
  options: CoverLetterOptions
): Promise<ServiceResult<CoverLetterResult>> {
  if (!options.company?.trim() || !options.role?.trim()) {
    return failure("INVALID_INPUT", "Company and role are required.");
  }

  const resumeSummary = flattenResumeText(resume.content).slice(0, 4000);
  const input = JSON.stringify({
    candidateName: resume.content.contact.fullName,
    resumeHighlights: resumeSummary,
  });

  const result = await generateContent({
    task: "generate_cover_letter",
    input,
    context: {
      targetRole: options.role,
      company: options.company,
      jobDescription: options.jobDescription,
      tone: options.tone ?? "professional",
    },
  });

  if (!result.ok || !result.data) {
    return failure("GENERATION_FAILED", result.error?.message ?? "Failed to generate cover letter.");
  }

  const body = result.data.output;
  return success<CoverLetterResult>({
    body,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  });
}
