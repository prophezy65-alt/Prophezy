/**
 * lib/ai/prompts/roadmap.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface RoadmapInput {
  goal: string;
  currentLevel: string;
  timeframeWeeks: number;
  hoursPerWeek?: number;
}

export interface RoadmapOutput {
  overview: string;
  milestones: {
    week: number;
    title: string;
    objectives: string[];
    resources: string[];
  }[];
}

export const ROADMAP_PROMPT: PromptDefinition<RoadmapInput, RoadmapOutput> = {
  version: "roadmap.v1",
  feature: "roadmap",
  systemPrompt:
    "You design realistic learning roadmaps. Pace the plan to the stated " +
    "timeframe and weekly hours — don't compress a year of material into a " +
    "month. Each milestone needs specific objectives (not 'learn basics') and " +
    "named resource types (course, doc, project) rather than invented URLs or " +
    "book titles you're not certain exist. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      "Goal: " + input.goal,
      wrapUserContent("current_level", input.currentLevel),
      "Timeframe: " + input.timeframeWeeks + " weeks",
      "Hours per week: " + (input.hoursPerWeek ?? 5),
    ].join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      overview: { type: "string" },
      milestones: {
        type: "array",
        items: {
          type: "object",
          properties: {
            week: { type: "number" },
            title: { type: "string" },
            objectives: { type: "array", items: { type: "string" } },
            resources: { type: "array", items: { type: "string" } },
          },
          required: ["week", "title", "objectives", "resources"],
        },
      },
    },
    required: ["overview", "milestones"],
  },
  generation: { temperature: 0.5, maxOutputTokens: 4096 },
};
