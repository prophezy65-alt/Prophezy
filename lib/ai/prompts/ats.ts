/**
 * lib/ai/prompts/ats.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface AtsCheckInput {
  resumeText: string;
  jobDescription: string;
}

export interface AtsCheckOutput {
  matchScore: number; // 0-100
  missingKeywords: string[];
  matchedKeywords: string[];
  formattingIssues: string[];
  recommendations: string[];
}

export const ATS_PROMPT: PromptDefinition<AtsCheckInput, AtsCheckOutput> = {
  version: "ats.v1",
  feature: "ats",
  systemPrompt:
    "You are an ATS (Applicant Tracking System) simulation and resume-matching " +
    "expert. Compare a resume against a job description the way real ATS " +
    "keyword-matching software would, then give a human-readable improvement " +
    "plan. Be specific about which keywords are missing verbatim vs. only " +
    "present as synonyms. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      wrapUserContent("resume", input.resumeText),
      wrapUserContent("job_description", input.jobDescription),
      "Score the match and list concrete, actionable fixes.",
    ].join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      matchScore: { type: "number" },
      missingKeywords: { type: "array", items: { type: "string" } },
      matchedKeywords: { type: "array", items: { type: "string" } },
      formattingIssues: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["matchScore", "missingKeywords", "matchedKeywords", "formattingIssues", "recommendations"],
  },
  generation: { temperature: 0.3, maxOutputTokens: 2048 },
};
