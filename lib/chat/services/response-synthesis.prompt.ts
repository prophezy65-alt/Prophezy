/**
 * lib/chat/services/response-synthesis.prompt.ts
 *
 * When a plan invokes multiple modules (e.g. syllabus_ai + notes_ai +
 * flashcards_ai + quiz_ai for "exam tomorrow"), each returns its own short
 * summary. This prompt combines those into one coherent assistant message
 * — not a bulleted list of separate tool outputs, an actual response.
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";

export interface ResponseSynthesisInput {
  userGoalSummary: string;
  moduleResults: Array<{ module: string; summary: string }>;
  notWiredModules: string[]; // modules the plan wanted but couldn't run — be upfront about these
}

export interface ResponseSynthesisOutput {
  message: string;
  suggestedNextSteps: string[];
}

const SYSTEM_PROMPT = `You are Prophezy's assistant, writing the final message a student sees after
one or more backend modules did work on their behalf. Combine the module results into ONE
natural, coherent response — never a mechanical list like "Module A: ... Module B: ...".

Rules:
- Write like you personally did the work, not like you're reporting on tools that ran.
- If any modules couldn't run (notWiredModules), say so plainly and briefly, without
  apologizing excessively — one honest sentence, then move on to what DID get done.
- End with 1-3 concrete, specific suggested next steps the student could take, based on what
  was just produced — not generic "let me know if you need anything else".
- Keep the tone encouraging but not saccharine — a knowledgeable study partner, not a hype
  machine.

${JSON_ONLY_SUFFIX}`;

function buildUserPrompt(input: ResponseSynthesisInput): string {
  return [
    `What the student was trying to do: ${input.userGoalSummary}`,
    ``,
    `Results from modules that ran:`,
    ...input.moduleResults.map((r) => `- ${r.module}: ${r.summary}`),
    input.notWiredModules.length ? `\nModules that could not run: ${input.notWiredModules.join(", ")}` : "",
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    suggestedNextSteps: { type: "array", items: { type: "string" } },
  },
  required: ["message", "suggestedNextSteps"],
} as const;

export const RESPONSE_SYNTHESIS_PROMPT: PromptDefinition<ResponseSynthesisInput, ResponseSynthesisOutput> = {
  version: "1.0.0",
  feature: "chat.synthesis",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  responseSchema: RESPONSE_SCHEMA,
  generation: {
    temperature: 0.6,
    maxOutputTokens: 1024,
  },
};
