/**
 * lib/ai/prompts/resume.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface ResumeBuildInput {
  targetRole: string;
  existingResumeText?: string;
  rawExperience: string;
  tone?: "professional" | "concise" | "impact-driven";
}

export interface ResumeBuildOutput {
  summary: string;
  sections: {
    experience: { title: string; company: string; dates: string; bullets: string[] }[];
    education: { degree: string; institution: string; dates: string }[];
    skills: string[];
    projects: { name: string; description: string; bullets: string[] }[];
  };
  suggestedImprovements: string[];
}

export const RESUME_PROMPT: PromptDefinition<ResumeBuildInput, ResumeBuildOutput> = {
  version: "resume.v1",
  feature: "resume",
  systemPrompt:
    "You are a professional resume writer and career coach. You write resume " +
    "content that is specific, achievement-oriented (metrics and outcomes over " +
    "duties), ATS-friendly, and tailored to the candidate's target role. Never " +
    "invent employers, dates, degrees, or metrics the candidate didn't provide " +
    "— if information is missing, leave the field empty or note it in " +
    "suggestedImprovements instead of fabricating it. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      "Target role: " + input.targetRole,
      "Preferred tone: " + (input.tone ?? "professional"),
      wrapUserContent("raw_experience", input.rawExperience),
      input.existingResumeText ? wrapUserContent("existing_resume", input.existingResumeText) : "",
      "Build a complete, tailored resume from the above.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      sections: {
        type: "object",
        properties: {
          experience: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                company: { type: "string" },
                dates: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
              },
              required: ["title", "company", "dates", "bullets"],
            },
          },
          education: {
            type: "array",
            items: {
              type: "object",
              properties: {
                degree: { type: "string" },
                institution: { type: "string" },
                dates: { type: "string" },
              },
              required: ["degree", "institution", "dates"],
            },
          },
          skills: { type: "array", items: { type: "string" } },
          projects: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
              },
              required: ["name", "description", "bullets"],
            },
          },
        },
        required: ["experience", "education", "skills", "projects"],
      },
      suggestedImprovements: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "sections", "suggestedImprovements"],
  },
  generation: { temperature: 0.6, maxOutputTokens: 4096 },
};
