/**
 * lib/ai/config/grok-client.ts
 *
 * The low-level entry point for talking to Grok (xAI). This is the
 * fallback-provider counterpart to config/client.ts (Gemini) — same
 * external shape (GenerateResult, StreamChunk) on purpose, so
 * provider-router.ts can call either one and hand the result to engine.ts
 * without engine.ts (or any feature service) needing to know which
 * provider actually answered.
 *
 * xAI's Chat Completions API is OpenAI-compatible:
 *   POST https://api.x.ai/v1/chat/completions
 *   Authorization: Bearer <key>
 *   { model, messages: [{role, content}], temperature, max_tokens,
 *     response_format?, stream? }
 *
 * Multi-key rotation + cooldown is delegated to config/grok-key-manager.ts,
 * exactly parallel to how config/client.ts delegates to config/key-manager.ts.
 * Retries on transient failures reuse utils/retry.ts (already provider-agnostic).
 */

import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import { AIConfigError, AIRequestError, AITimeoutError } from "../utils/errors";
import type { GeminiMessage, GenerateResult, StreamChunk } from "./client";
import { DEFAULT_GROK_MODEL, GROK_MODELS, type GrokModelId } from "./grok-models";
import {
  getGrokKeyOrder,
  reportGrokKeySuccess,
  reportGrokKeyFailure,
  classifyGrokFailure,
  assertGrokKeysConfigured,
  GrokAllKeysExhaustedError,
} from "./grok-key-manager";

export { GrokAllKeysExhaustedError } from "./grok-key-manager";

// NOTE: keys configured in GROK_API_KEY_* are Groq (GroqCloud) keys (gsk_...),
// not xAI Grok keys (xai-...), so this points at Groq's OpenAI-compatible
// endpoint instead of api.x.ai. Everything else in this file is unchanged.
const GROK_API_BASE = "https://api.groq.com/openai/v1";

export interface GrokGenerateOptions {
  model?: GrokModelId;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  requestId?: string;
  feature?: string;
}

type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

/**
 * Converts Gemini's {role: "user"|"model", parts:[...]} conversation shape
 * into OpenAI-style {role: "user"|"assistant", content}. This is the one
 * place the two providers' wire formats get reconciled, so every feature
 * service (which only ever builds GeminiMessage[]) keeps working unchanged
 * when a call falls over to Grok.
 */
export function toOpenAIMessages(messages: GeminiMessage[], systemInstruction?: string): OpenAIChatMessage[] {
  const out: OpenAIChatMessage[] = [];
  if (systemInstruction) {
    out.push({ role: "system", content: systemInstruction });
  }

  for (const m of messages) {
    const role: "user" | "assistant" = m.role === "model" ? "assistant" : "user";
    const content: OpenAIChatMessage["content"] = m.parts.map((p) => {
      if ("text" in p) return { type: "text" as const, text: p.text };
      // Gemini inlineData -> OpenAI data-URI image_url, so multimodal
      // features (e.g. OCR's vision fallback) degrade gracefully instead of
      // silently dropping the image when a request fails over to Grok.
      return {
        type: "image_url" as const,
        image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` },
      };
    });

    // Collapse to a plain string when it's text-only — keeps the request
    // body simple/compatible for the common (non-multimodal) case.
    const simplified = content.every((c) => c.type === "text")
      ? content.map((c) => (c as { type: "text"; text: string }).text).join("\n")
      : content;

    out.push({ role, content: simplified });
  }

  return out;
}

function composeSignal(timeoutMs: number, callerSignal?: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new AITimeoutError("Grok request timed out")), timeoutMs);

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason));
  }

  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function isKeyRotationCandidate(err: unknown): boolean {
  if (err instanceof AITimeoutError) return true;
  if (err instanceof AIRequestError) {
    const kind = classifyGrokFailure(err);
    return kind === "quota" || kind === "invalid" || kind === "server";
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Non-streaming generation                                                    */
/* -------------------------------------------------------------------------- */

export async function generateGrok(
  messages: GeminiMessage[],
  opts: GrokGenerateOptions = {}
): Promise<GenerateResult> {
  assertGrokKeysConfigured();

  const modelId = opts.model ?? DEFAULT_GROK_MODEL;
  const profile = GROK_MODELS[modelId] ?? GROK_MODELS[DEFAULT_GROK_MODEL];
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const maxRetries = opts.maxRetries ?? 2;
  const openAiMessages = toOpenAIMessages(messages, opts.systemInstruction);

  const keyOrder = getGrokKeyOrder();
  let lastErr: unknown;

  for (const keyState of keyOrder) {
    try {
      const result = await withRetry(
        async () => {
          const { signal, clear } = composeSignal(timeoutMs, opts.signal);
          try {
            const res = await fetch(`${GROK_API_BASE}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${keyState.key}`,
              },
              signal,
              body: JSON.stringify({
                model: modelId,
                messages: openAiMessages,
                temperature: opts.temperature ?? profile.defaultTemperature,
                max_tokens: opts.maxOutputTokens ?? profile.defaultMaxOutputTokens,
                top_p: opts.topP,
                ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
              }),
            });

            const json = await res.json();

            if (!res.ok) {
              throw new AIRequestError(
                json?.error?.message ?? `Grok request failed with status ${res.status}`,
                res.status,
                json
              );
            }

            const choice = json.choices?.[0];
            const text: string = choice?.message?.content ?? "";
            const finishReason: string | null = choice?.finish_reason ?? null;

            return {
              text,
              finishReason,
              usage: {
                promptTokens: json.usage?.prompt_tokens ?? 0,
                outputTokens: json.usage?.completion_tokens ?? 0,
                totalTokens: json.usage?.total_tokens ?? 0,
              },
              raw: json,
            } satisfies GenerateResult;
          } finally {
            clear();
          }
        },
        { maxRetries }
      );

      reportGrokKeySuccess(keyState.index);
      logger.info("ai.grok.generate.success", {
        requestId: opts.requestId,
        feature: opts.feature ?? null,
        model: modelId,
        keyLabel: `grok key #${keyState.index + 1}`,
      });
      return result;
    } catch (err) {
      lastErr = err;

      if (err instanceof Error && err.name === "AbortError") {
        lastErr = new AITimeoutError("Grok request timed out");
      }

      if (!isKeyRotationCandidate(lastErr)) {
        throw lastErr;
      }

      const kind = reportGrokKeyFailure(keyState.index, lastErr);
      logger.warn("ai.grok.generate.key_rotation", {
        requestId: opts.requestId,
        feature: opts.feature ?? null,
        model: modelId,
        exhaustedKeyLabel: `grok key #${keyState.index + 1}`,
        reason: kind,
        keysRemaining: keyOrder.length - (keyOrder.indexOf(keyState) + 1),
      });
    }
  }

  logger.error("ai.grok.generate.all_keys_exhausted", {
    requestId: opts.requestId,
    feature: opts.feature ?? null,
    model: modelId,
    keysTried: keyOrder.length,
    lastFailureMessage: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
  throw new GrokAllKeysExhaustedError(keyOrder.length);
}

/* -------------------------------------------------------------------------- */
/* Streaming generation                                                        */
/* -------------------------------------------------------------------------- */

export async function* streamGenerateGrok(
  messages: GeminiMessage[],
  opts: GrokGenerateOptions = {}
): AsyncGenerator<StreamChunk, void, unknown> {
  assertGrokKeysConfigured();

  const modelId = opts.model ?? DEFAULT_GROK_MODEL;
  const profile = GROK_MODELS[modelId] ?? GROK_MODELS[DEFAULT_GROK_MODEL];
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const openAiMessages = toOpenAIMessages(messages, opts.systemInstruction);
  const keyOrder = getGrokKeyOrder();

  let accumulated = "";
  let lastErr: unknown;

  for (const keyState of keyOrder) {
    const { signal, clear } = composeSignal(timeoutMs, opts.signal);
    accumulated = "";

    try {
      const res = await fetch(`${GROK_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keyState.key}`,
        },
        signal,
        body: JSON.stringify({
          model: modelId,
          messages: openAiMessages,
          temperature: opts.temperature ?? profile.defaultTemperature,
          max_tokens: opts.maxOutputTokens ?? profile.defaultMaxOutputTokens,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => null);
        throw new AIRequestError(
          errJson?.error?.message ?? `Grok stream failed with status ${res.status}`,
          res.status,
          errJson
        );
      }

      reportGrokKeySuccess(keyState.index);
      logger.info("ai.grok.stream.started", {
        requestId: opts.requestId,
        feature: opts.feature ?? null,
        model: modelId,
        keyLabel: `grok key #${keyState.index + 1}`,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const json = JSON.parse(payload);
            const delta: string = json.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              accumulated += delta;
              yield { delta, accumulated, done: false };
            }
          } catch {
            // Ignore malformed SSE fragments; next chunk usually completes it.
          }
        }
      }

      yield { delta: "", accumulated, done: true };
      return;
    } catch (err) {
      lastErr = err;

      if (err instanceof Error && err.name === "AbortError") {
        throw new AITimeoutError("Grok request timed out");
      }

      if (!isKeyRotationCandidate(err)) {
        throw err;
      }

      const kind = reportGrokKeyFailure(keyState.index, err);
      logger.warn("ai.grok.stream.key_rotation", {
        requestId: opts.requestId,
        feature: opts.feature ?? null,
        model: modelId,
        exhaustedKeyLabel: `grok key #${keyState.index + 1}`,
        reason: kind,
      });
    } finally {
      clear();
    }
  }

  logger.error("ai.grok.stream.all_keys_exhausted", {
    requestId: opts.requestId,
    feature: opts.feature ?? null,
    model: modelId,
    keysTried: keyOrder.length,
  });
  throw new GrokAllKeysExhaustedError(keyOrder.length);
}
