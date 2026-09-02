/**
 * lib/ai/prompts/project.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface ProjectGenInput {
  interests: string;
  skillLevel: "beginner" | "intermediate" | "advanced";
  goal?: string; // e.g. "portfolio piece", "learn X", "resume-worthy"
}

export interface ProjectGenOutput {
  ideas: {
    title: string;
    description: string;
    techStack: string[];
    milestones: string[];
    stretchGoals: string[];
  }[];
}

export const PROJECT_PROMPT: PromptDefinition<ProjectGenInput, ProjectGenOutput> = {
  version: "project.v1",
  feature: "project",
  systemPrompt:
    "You generate concrete, buildable project ideas scoped to the learner's " +
    "actual skill level — a beginner idea must be finishable in days, not " +
    "months. Each idea needs a realistic milestone breakdown, not just a " +
    "one-line pitch. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      wrapUserContent("interests", input.interests),
      "Skill level: " + input.skillLevel,
      input.goal ? "Goal: " + input.goal : "",
      "Suggest 3 project ideas.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            techStack: { type: "array", items: { type: "string" } },
            milestones: { type: "array", items: { type: "string" } },
            stretchGoals: { type: "array", items: { type: "string" } },
          },
          required: ["title", "description", "techStack", "milestones", "stretchGoals"],
        },
      },
    },
    required: ["ideas"],
  },
  generation: { temperature: 0.8, maxOutputTokens: 3072 },
};
