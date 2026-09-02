/**
 * lib/ai/prompts/humanizer.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface HumanizerInput {
  text: string;
  tone?: "academic" | "casual" | "professional";
}

export interface HumanizerOutput {
  rewritten: string;
  changesSummary: string[];
}

export const HUMANIZER_PROMPT: PromptDefinition<HumanizerInput, HumanizerOutput> = {
  version: "humanizer.v1",
  feature: "humanizer",
  systemPrompt:
    "You rewrite text to read more naturally and vary sentence rhythm, word " +
    "choice, and structure — the goal is clearer, more natural writing in the " +
    "requested tone, not disguising authorship or evading plagiarism/AI " +
    "detection. Preserve the original meaning, facts, and claims exactly; " +
    "never add, remove, or soften factual content. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [wrapUserContent("text", input.text), "Target tone: " + (input.tone ?? "academic")].join(
      "\n\n"
    ),
  responseSchema: {
    type: "object",
    properties: {
      rewritten: { type: "string" },
      changesSummary: { type: "array", items: { type: "string" } },
    },
    required: ["rewritten", "changesSummary"],
  },
  generation: { temperature: 0.6, maxOutputTokens: 4096 },
};
