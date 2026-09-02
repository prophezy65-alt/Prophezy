/**
 * lib/interview/prompts/roadmap.ts
 *
 * NOTE: Prophezy already has a general-purpose roadmap generator registered
 * under feature "roadmap" (see FEATURE_MODEL_MAP in lib/ai/config/models.ts).
 * This module defines its own interview-specific roadmap prompt instead of
 * importing that service directly, because its exact input/output shape
 * wasn't available to verify against. If lib/ai/services/roadmap.service.ts
 * already accepts a weak-skills list and returns a compatible structure,
 * swap skillgap.service.ts to call that instead of runStructured(ROADMAP_PROMPT, ...)
 * to avoid the duplication — the AI Core Engine is not meant to be modified,
 * but this file lives entirely in lib/interview/ and can be deleted once
 * that swap is made.
 */
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "../../ai/prompts/_shared";

export interface RoadmapInput {
  role: string;
  weakSkills: { skill: string; score: number }[];
  strongSkills: { skill: string; score: number }[];
}

export interface RoadmapOutput {
  roadmap: {
    topic: string;
    priority: "high" | "medium" | "low";
    reason: string;
    suggestedActions: string[];
  }[];
}

export const ROADMAP_PROMPT: PromptDefinition<RoadmapInput, RoadmapOutput> = {
  version: "interview.roadmap.v1",
  feature: "interview-roadmap",
  systemPrompt: [
    "You build a prioritized interview-prep study roadmap from a candidate's " +
      "measured weak and strong skills. Prioritize skills that are both weak " +
      "and core to the target role. Each roadmap item needs a short reason " +
      "tied to the actual scores given, and 2-4 concrete suggestedActions " +
      "(e.g. 'practice 5 system design case studies', 'review SQL window " +
      "functions') — not vague advice like 'study more'.",
    JSON_ONLY_SUFFIX,
  ].join("\n\n"),
  buildUserPrompt: (input) =>
    [
      `Target role: ${input.role}`,
      `Weak skills: ${input.weakSkills.map((s) => `${s.skill} (${s.score}/10)`).join(", ") || "none recorded"}`,
      `Strong skills: ${input.strongSkills.map((s) => `${s.skill} (${s.score}/10)`).join(", ") || "none recorded"}`,
    ].join("\n"),
  responseSchema: {
    type: "object",
    properties: {
      roadmap: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            reason: { type: "string" },
            suggestedActions: { type: "array", items: { type: "string" } },
          },
          required: ["topic", "priority", "reason", "suggestedActions"],
        },
      },
    },
    required: ["roadmap"],
  },
  generation: { temperature: 0.5, maxOutputTokens: 2048 },
};
