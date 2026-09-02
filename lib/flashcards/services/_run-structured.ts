/**
 * lib/flashcards/services/_run-structured.ts
 *
 * ASSUMPTION: your README describes `services/_run-structured.ts` as
 * "Shared runner: PromptDefinition -> runAI(jsonMode) -> typed result. Every
 * one-shot service below is a thin wrapper around this." I don't have that
 * file's actual contents (you didn't share an example one-shot service), so
 * this is a same-shaped reimplementation built directly against the real
 * `runAI` signature in lib/ai/engine.ts. If your existing
 * `lib/ai/services/_run-structured.ts` already does this, DELETE this file
 * and import that one instead — flashcard services below only depend on the
 * `runStructured` export, so swapping the implementation is a one-line
 * change per service file.
 */

import { runAI, type RunAIParams } from "@/lib/ai/engine";
import type { PromptDefinition } from "@/lib/ai/prompts/_shared";

export interface RunStructuredOptions {
  userId: string;
  forceRefresh?: boolean;
  cacheable?: boolean;
  requestId?: string;
}

export interface StructuredResult<TOutput> {
  json: TOutput;
  text: string;
  requestId: string;
  cached: boolean;
}

export async function runStructured<TInput, TOutput>(
  prompt: PromptDefinition<TInput, TOutput>,
  input: TInput,
  options: RunStructuredOptions
): Promise<StructuredResult<TOutput>> {
  const params: RunAIParams = {
    feature: prompt.feature,
    userId: options.userId,
    systemInstruction: prompt.systemPrompt,
    messages: [
      {
        role: "user",
        parts: [{ text: prompt.buildUserPrompt(input) }],
      },
    ],
    jsonMode: true,
    responseSchema: prompt.responseSchema,
    temperature: prompt.generation.temperature,
    maxOutputTokens: prompt.generation.maxOutputTokens,
    forceRefresh: options.forceRefresh,
    cacheable: options.cacheable,
    requestId: options.requestId,
  };

  const result = await runAI<TOutput>(params);

  if (result.json === null) {
    throw new Error(
      `runStructured: runAI returned no parsed JSON for feature "${prompt.feature}" — ` +
        "this should be unreachable since jsonMode was true; runAI would have thrown first."
    );
  }

  return {
    json: result.json,
    text: result.text,
    requestId: result.requestId,
    cached: result.cached,
  };
}
