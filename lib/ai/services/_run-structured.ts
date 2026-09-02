/**
 * lib/ai/services/_run-structured.ts
 *
 * Every "one-shot JSON" feature (resume, ats, research, assignment, career,
 * project, roadmap, flashcards, quiz, mindmap, humanizer, notes, ocr) has
 * the exact same shape: build a user prompt from a PromptDefinition, call
 * runAI in jsonMode, return the typed result. This helper is that shape,
 * written once, so no individual service file duplicates it.
 */

import { runAI } from "../engine";
import type { PromptDefinition } from "../prompts/_shared";

export interface RunStructuredParams<TInput> {
  userId: string;
  input: TInput;
  forceRefresh?: boolean;
  requestId?: string;
}

export async function runStructured<TInput, TOutput>(
  prompt: PromptDefinition<TInput, TOutput>,
  params: RunStructuredParams<TInput>
): Promise<TOutput> {
  const result = await runAI<TOutput>({
    feature: prompt.feature,
    userId: params.userId,
    systemInstruction: prompt.systemPrompt + `\n\n[prompt version: ${prompt.version}]`,
    messages: [{ role: "user", parts: [{ text: prompt.buildUserPrompt(params.input) }] }],
    jsonMode: true,
    responseSchema: prompt.responseSchema,
    temperature: prompt.generation.temperature,
    maxOutputTokens: prompt.generation.maxOutputTokens,
    forceRefresh: params.forceRefresh,
    requestId: params.requestId,
  });

  if (result.json === null) {
    // Should be unreachable — runAI throws AIValidationError on parse failure
    // — but keeps the return type honest without a non-null assertion.
    throw new Error(`${prompt.feature}: model returned no parsable JSON.`);
  }

  return result.json;
}
