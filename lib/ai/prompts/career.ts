/**
 * lib/ai/prompts/career.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface CareerInput {
  background: string; // skills, education, experience, interests
  goal: string; // e.g. "break into data science", "next promotion"
}

export interface CareerOutput {
  assessment: string;
  suggestedPaths: { title: string; why: string; firstSteps: string[] }[];
  skillGaps: string[];
  timelineMonths: number;
}

export const CAREER_PROMPT: PromptDefinition<CareerInput, CareerOutput> = {
  version: "career.v1",
  feature: "career",
  systemPrompt:
    "You are a career advisor. Give realistic, specific guidance grounded in " +
    "what the person has actually told you about their background — don't " +
    "assume credentials, experience, or resources they haven't mentioned. " +
    "Prefer concrete first steps over generic advice like 'network more'. " +
    JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [wrapUserContent("background", input.background), "Goal: " + input.goal].join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      assessment: { type: "string" },
      suggestedPaths: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            why: { type: "string" },
            firstSteps: { type: "array", items: { type: "string" } },
          },
          required: ["title", "why", "firstSteps"],
        },
      },
      skillGaps: { type: "array", items: { type: "string" } },
      timelineMonths: { type: "number" },
    },
    required: ["assessment", "suggestedPaths", "skillGaps", "timelineMonths"],
  },
  generation: { temperature: 0.5, maxOutputTokens: 3072 },
};
