/**
 * lib/interview/prompts/company-context.ts
 *
 * Produces a structured "how this company tends to interview" profile,
 * used to bias question generation (company.service.ts feeds this into
 * QuestionGenInput as extra jobDescription-style context).
 */
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "../../ai/prompts/_shared";

export interface CompanyContextInput {
  company: string;
  role?: string;
}

export interface CompanyContextOutput {
  knownFocusAreas: string[];
  typicalRounds: string[];
  notes: string;
}

export const COMPANY_CONTEXT_PROMPT: PromptDefinition<CompanyContextInput, CompanyContextOutput> = {
  version: "interview.company-context.v1",
  feature: "interview-company",
  systemPrompt: [
    "You summarize the well-known, publicly documented interview process and " +
      "focus areas for a company, for interview-prep purposes.",
    "If you are not confident about a specific company's process, respond " +
      "with generic-but-honest industry-standard rounds for that company's " +
      "sector rather than fabricating specifics — do not invent named " +
      "interviewer titles, exact question text, or specific interview dates.",
    JSON_ONLY_SUFFIX,
  ].join("\n\n"),
  buildUserPrompt: (input) =>
    `Company: ${input.company}` + (input.role ? `\nRole: ${input.role}` : ""),
  responseSchema: {
    type: "object",
    properties: {
      knownFocusAreas: { type: "array", items: { type: "string" } },
      typicalRounds: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
    },
    required: ["knownFocusAreas", "typicalRounds", "notes"],
  },
  generation: { temperature: 0.4, maxOutputTokens: 1024 },
};
