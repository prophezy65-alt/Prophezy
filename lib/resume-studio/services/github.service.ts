/**
 * github.service.ts
 * Generates a short GitHub profile bio (<160 chars) from resume content.
 */

import { Resume, ServiceResult, success, failure } from "../models/resume.model";
import { flattenResumeText } from "../utils/resume-keywords";
import { generateContent } from "./generator.service";

export interface GithubBioResult {
  bio: string;
  characterCount: number;
}

const GITHUB_BIO_MAX_CHARS = 160;

export async function generateGithubBio(
  resume: Resume,
  targetRole?: string
): Promise<ServiceResult<GithubBioResult>> {
  const resumeSummary = flattenResumeText(resume.content).slice(0, 2000);

  const result = await generateContent({
    task: "generate_github_bio",
    input: resumeSummary,
    context: { targetRole, tone: "concise" },
  });

  if (!result.ok || !result.data) {
    return failure("GENERATION_FAILED", result.error?.message ?? "Failed to generate GitHub bio.");
  }

  let bio = result.data.output.trim();
  if (bio.length > GITHUB_BIO_MAX_CHARS) {
    bio = bio.slice(0, GITHUB_BIO_MAX_CHARS - 1).trim() + "…";
  }

  return success<GithubBioResult>({ bio, characterCount: bio.length });
}
