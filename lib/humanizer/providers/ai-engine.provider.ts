// lib/humanizer/providers/ai-engine.provider.ts
//
// Identical contract to lib/assignment/providers/ai-engine.provider.ts — this
// is intentional duplication, not drift: each feature module owns its own
// thin adapter over the Core Engine so they can be modified/tested
// independently, while both ultimately call the SAME lib/ai/engine.ts
// runAI()/runAIStream() functions. No file in lib/humanizer/ imports
// lib/ai/* directly except this one.

import { runAI, runAIStream } from "@/lib/ai/engine";
import type { PromptDefinition } from "../prompts/_shared";

export interface HumanizerAiCallOptions {
  userId: string;
  routingHint: "flash" | "pro" | "lite";
}

export class HumanizerAiError extends Error {
  constructor(message: string, public override readonly cause: unknown, public readonly promptId: string) {
    super(message);
    this.name = "HumanizerAiError";
  }
}

export async function runHumanizerPrompt<TResponse>(
  prompt: PromptDefinition<TResponse>,
  input: Record<string, unknown>,
  options: HumanizerAiCallOptions
): Promise<TResponse> {
  try {
    const result = await runAI<TResponse>({
      feature: prompt.id,
      userId: options.userId,
      systemInstruction: prompt.systemPrompt,
      messages: [{ role: "user", parts: [{ text: prompt.buildUserPrompt(input) }] }],
      jsonMode: prompt.jsonMode,
      temperature: prompt.temperature,
      maxOutputTokens: prompt.maxTokens,
    });

    if (result.json === null) {
      throw new HumanizerAiError(`Prompt "${prompt.id}" expected JSON output but runAI returned none`, null, prompt.id);
    }

    const parsed = result.json;
    if (!prompt.validate(parsed)) {
      throw new HumanizerAiError(`Response from prompt "${prompt.id}" failed shape validation`, parsed, prompt.id);
    }
    return parsed;
  } catch (err) {
    if (err instanceof HumanizerAiError) throw err;
    throw new HumanizerAiError(`AI call failed for prompt "${prompt.id}"`, err, prompt.id);
  }
}

export async function* streamHumanizerPrompt(
  systemPrompt: string,
  userPrompt: string,
  options: HumanizerAiCallOptions
): AsyncGenerator<string, void, unknown> {
  try {
    const stream = runAIStream({
      feature: "humanizer",
      userId: options.userId,
      systemInstruction: systemPrompt,
      messages: [{ role: "user", parts: [{ text: userPrompt }] }],
    });
    for await (const chunk of stream) {
      yield chunk.accumulated;
    }
  } catch (err) {
    throw new HumanizerAiError("Streaming AI call failed", err, "humanizer.stream");
  }
}
