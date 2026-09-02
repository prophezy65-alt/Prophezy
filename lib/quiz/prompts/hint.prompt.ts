/**
 * lib/quiz/prompts/hint.prompt.ts
 *
 * Every question already ships with one base hint (generated alongside the
 * question in quiz-generation.prompt.ts). This prompt is for hint.service.ts
 * to generate progressively stronger hints on request (level 2 = more
 * specific, level 3 = nearly gives it away) without ever stating the answer
 * outright at any level.
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";

export interface HintInput {
  questionText: string;
  previousHints: string[]; // hints already shown, including the base hint
  hintLevel: 2 | 3;
}

export interface HintOutput {
  hint: string;
}

const SYSTEM_PROMPT = `You generate progressive hints for a quiz question. The learner has
already seen the previous hints listed. Your job is to give a MORE specific hint than those,
without ever stating the final answer.

- Level 2 hints should narrow down the approach or eliminate one wrong path.
- Level 3 hints should get very close — a strong learner should be able to get the answer
  immediately after reading it — but must still stop short of stating the literal answer.
- Never repeat a previous hint's wording or information.

${JSON_ONLY_SUFFIX}`;

function buildUserPrompt(input: HintInput): string {
  return [
    `Question: ${input.questionText}`,
    `Requested hint level: ${input.hintLevel}`,
    `Hints already shown:`,
    ...input.previousHints.map((h, i) => `${i + 1}. ${h}`),
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: { hint: { type: "string" } },
  required: ["hint"],
} as const;

export const HINT_PROMPT: PromptDefinition<HintInput, HintOutput> = {
  version: "1.0.0",
  feature: "quiz.hint",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  responseSchema: RESPONSE_SCHEMA,
  generation: {
    temperature: 0.4,
    maxOutputTokens: 256,
  },
};
