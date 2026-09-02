// lib/assignment/providers/ai-engine.provider.ts
//
// SOLE integration point between the Assignment Intelligence Engine and the
// real AI Core Engine (lib/ai/engine.ts). No other file under lib/assignment/
// imports lib/ai/* directly — every service goes through the functions
// exported here.
//
// This was rewritten against the ACTUAL runAI()/runAIStream() signature
// (previously this file was built against a partially-guessed API from
// screenshots — this version is corrected against the real source):
//
//   - runAI({ feature, userId, systemInstruction, messages, jsonMode, ... })
//     returns RunAIResult<T> = { text, json: T|null, requestId, cached, usage }
//     — NOT the parsed object directly.
//   - There is no promptId, no model/routing-hint param. Model selection is
//     driven entirely by `feature` (a bucket string matching the Core
//     Engine's RATE_LIMIT_RULES / model-routing config, e.g. "resume",
//     "assignment") — not a per-call hint.
//   - There is no `image` field on RunAIParams. Multimodal input goes in as
//     an extra part on the user message.
//   - messages is GeminiMessage[] (role + parts), not a systemPrompt/userPrompt
//     string pair — systemInstruction is separate.
//   - runAIStream yields StreamChunk objects whose `.accumulated` field is
//     the CUMULATIVE text so far, not an incremental delta.

import { runAI, runAIStream } from "@/lib/ai/engine";
import type { GeminiMessage } from "@/lib/ai/config/client";
import type { PromptDefinition } from "../prompts/_shared";

export interface AssignmentAiCallOptions {
  userId: string;
  /** Overrides prompt.feature for this call if provided. Useful when the
   * same PromptDefinition is called from contexts that should route through
   * different Core Engine rate-limit/model buckets (see rewrite-style
   * services for an example pattern in lib/humanizer). Usually omitted —
   * prompt.feature is the right default. */
  feature?: string;
  /** Optional image input for OCR vision fallback. Raw base64, no data: URI
   * prefix. Appended as an inlineData part on the user message — this
   * assumes Gemini's standard inlineData part shape, since GeminiMessage's
   * non-text part variants aren't visible from outside lib/ai/config/client.ts.
   * If that assumption is wrong, this is the one spot to fix. */
  imageBase64?: string;
  imageMimeType?: string;
  /** Forwarded to runAI — set true for a "Regenerate" action to skip the cache. */
  forceRefresh?: boolean;
}

export class AssignmentAiError extends Error {
  constructor(
    message: string,
    public readonly aiCause: unknown,
    public readonly promptId: string
  ) {
    super(message);
    this.name = "AssignmentAiError";
  }
}

function buildMessages(userPromptText: string, options: AssignmentAiCallOptions): GeminiMessage[] {
  const parts: GeminiMessage["parts"] = [{ text: userPromptText }];

  if (options.imageBase64 && options.imageMimeType) {
    // Gemini's standard inline-image part shape. Cast is necessary because
    // GeminiMessage's part union isn't exported for us to reference by name.
    parts.push({
      inlineData: { mimeType: options.imageMimeType, data: options.imageBase64 },
    } as unknown as GeminiMessage["parts"][number]);
  }

  return [{ role: "user", parts }];
}

/**
 * Runs a one-shot, JSON-mode assignment prompt through the Core Engine and
 * returns the typed, validated result. Throws AssignmentAiError on any
 * failure (network, safety block, missing/invalid JSON, or shape validation).
 */
export async function runAssignmentPrompt<TResponse>(
  prompt: PromptDefinition<TResponse>,
  input: Record<string, unknown>,
  options: AssignmentAiCallOptions
): Promise<TResponse> {
  try {
    const result = await runAI<TResponse>({
      feature: options.feature ?? prompt.feature,
      userId: options.userId,
      systemInstruction: prompt.systemPrompt,
      messages: buildMessages(prompt.buildUserPrompt(input), options),
      jsonMode: prompt.jsonMode,
      temperature: prompt.temperature,
      maxOutputTokens: prompt.maxOutputTokens,
      forceRefresh: options.forceRefresh,
    });

    if (result.json === null) {
      throw new AssignmentAiError(
        `Prompt "${prompt.id}" expected JSON output but runAI returned none (raw text: ${result.text.slice(0, 200)})`,
        null,
        prompt.id
      );
    }

    if (!prompt.validate(result.json)) {
      throw new AssignmentAiError(`Response from prompt "${prompt.id}" failed shape validation`, result.json, prompt.id);
    }

    return result.json;
  } catch (err) {
    if (err instanceof AssignmentAiError) throw err;
    throw new AssignmentAiError(`AI call failed for prompt "${prompt.id}"`, err, prompt.id);
  }
}

/**
 * Streaming variant for long-form generation where the frontend wants to
 * render tokens as they arrive. `runAIStream`'s chunks carry the CUMULATIVE
 * text so far (chunk.accumulated), not a delta — this generator yields that
 * cumulative string directly on every tick; callers wanting a delta stream
 * should diff against the previously-yielded value themselves.
 */
export async function* streamAssignmentPrompt(
  feature: string,
  systemInstruction: string,
  userPromptText: string,
  options: AssignmentAiCallOptions
): AsyncGenerator<string, void, unknown> {
  try {
    const stream = runAIStream({
      feature,
      userId: options.userId,
      systemInstruction,
      messages: buildMessages(userPromptText, options),
    });
    for await (const chunk of stream) {
      yield chunk.accumulated;
    }
  } catch (err) {
    throw new AssignmentAiError("Streaming AI call failed", err, `stream:${feature}`);
  }
}
