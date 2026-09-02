/**
 * lib/ai/engine.ts
 *
 * THE brain of Prophezy. Every AI feature (resume, research, quiz,
 * flashcards, roadmap, interview, etc.) calls `runAI` or `runAIStream` —
 * never `generate`/`streamGenerate` from config/client.ts directly.
 *
 * This is where rate limiting, caching, safety, retries, validation, and
 * analytics all get wired together in one place, so adding a new feature
 * service is just: write a prompt template + call this function.
 */

import {
  type GeminiMessage,
  type GenerateOptions,
  type StreamChunk,
} from "./config/client";
import {
  generateWithFallback,
  streamGenerateWithFallback,
  type AIProvider,
} from "./config/provider-router";
import { resolveModelForFeature } from "./config/models";
import { enforceRateLimit } from "./middleware/rate-limit";
import { withCache } from "./middleware/cache";
import { assertSafeResponse, sanitizeInput } from "./middleware/safety";
import { trackUsage } from "./middleware/analytics";
import { safeJsonParse } from "./utils/json";
import { normalizeWhitespace } from "./utils/formatter";
import { logger } from "./utils/logger";
import { AIValidationError } from "./utils/errors";

export interface RunAIParams {
  /** Which feature is calling in — drives model routing, rate limits, prompt versioning */
  feature: string;
  /** Authenticated user id, for rate limiting + analytics. Pass "anonymous" only for public/demo routes. */
  userId: string;
  /** Fully-built system instruction for this call (from lib/ai/prompts/<feature>.ts) */
  systemInstruction: string;
  /** Conversation so far, ending with the newest user message */
  messages: GeminiMessage[];
  /** Ask Gemini to return strict JSON matching this schema */
  jsonMode?: boolean;
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  /** Skip the response cache for this call (e.g. a "Regenerate" button) */
  forceRefresh?: boolean;
  /** Disable caching entirely for calls that must always be fresh (e.g. chat) */
  cacheable?: boolean;
  requestId?: string;
}

export interface RunAIResult<T = unknown> {
  text: string;
  json: T | null;
  requestId: string;
  cached: boolean;
  usage: {
    promptTokens: number;
    outputTokens: number;
  };
  /**
   * Which provider actually answered this call — "gemini" for the normal
   * path, "grok" when Gemini was exhausted/rate-limited/unavailable and
   * the request was automatically handed off. Callers can ignore this
   * entirely; it exists for logging/observability, not for branching
   * feature behavior.
   */
  provider: AIProvider;
}

function makeRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Non-streaming entry point. Handles the full lifecycle:
 * rate limit -> cache lookup -> sanitize -> call Gemini -> safety check ->
 * parse -> track usage -> return.
 */
export async function runAI<T = unknown>(params: RunAIParams): Promise<RunAIResult<T>> {
  const requestId = params.requestId ?? makeRequestId();
  const start = Date.now();
  const model = resolveModelForFeature(params.feature);

  await enforceRateLimit(params.userId, params.feature);

  const genOptions: GenerateOptions = {
    model: model.id,
    systemInstruction: params.systemInstruction,
    jsonMode: params.jsonMode,
    responseSchema: params.responseSchema,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    requestId,
  };

  const cacheable = params.cacheable ?? true;

  const execute = async () => {
    const sanitizedMessages: GeminiMessage[] = params.messages.map((m) => ({
      role: m.role,
      parts: m.parts.map((p) =>
        "text" in p ? { text: sanitizeInput(p.text).clean } : p
      ),
    }));

    // generateWithFallback() is a straight drop-in for generate(): it tries
    // Gemini (full existing key rotation + cooldown, untouched) and, ONLY
    // if Gemini itself is exhausted/rate-limited/unavailable, transparently
    // retries the same request against Grok. Everything below this line
    // (safety check, JSON parsing, caching, usage tracking) runs identically
    // regardless of which provider actually answered.
    const result = await generateWithFallback(sanitizedMessages, {
      ...genOptions,
      feature: params.feature,
    });

    // Grok responses don't carry Gemini's candidates[]/safetyRatings shape,
    // so the Gemini-specific safety check only applies when Gemini itself
    // answered. A Grok response is validated by its own provider's content
    // policy on x.ai's side before ever reaching us.
    if (result.provider === "gemini") {
      const candidate = (result.raw as any)?.candidates?.[0];
      assertSafeResponse(candidate);
    }

    return result;
  };

  let cached = false;
  const result = cacheable
    ? await withCache(
        `response:${params.feature}`,
        { messages: params.messages, opts: genOptions },
        async () => {
          const r = await execute();
          return r;
        },
        { forceRefresh: params.forceRefresh }
      ).then((r) => {
        cached = !params.forceRefresh;
        return r;
      })
    : await execute();

  const text = normalizeWhitespace(result.text);

  if (result.finishReason === "MAX_TOKENS") {
    logger.warn("ai.engine.truncated", {
      requestId,
      feature: params.feature,
      model: model.id,
      maxOutputTokens: genOptions.maxOutputTokens,
      outputTokens: result.usage.outputTokens,
    });
  }

  let json: T | null = null;
  if (params.jsonMode) {
    const parsed = safeJsonParse<T>(text);
    if (!parsed.ok) {
      throw new AIValidationError("Model did not return valid JSON.", { raw: text });
    }
    json = parsed.data;
  }

  await trackUsage({
    requestId,
    userId: params.userId,
    feature: params.feature,
    model: result.modelUsed,
    provider: result.provider,
    promptTokens: result.usage.promptTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - start,
    success: true,
    cacheHit: cached,
  });

  if (result.provider === "grok") {
    logger.warn("ai.engine.served_by_fallback_provider", {
      requestId,
      feature: params.feature,
      primaryModel: model.id,
      fallbackModel: result.modelUsed,
    });
  }

  logger.info("ai.engine.run_complete", {
    requestId,
    feature: params.feature,
    provider: result.provider,
    durationMs: Date.now() - start,
    cached,
  });

  return {
    text,
    json,
    requestId,
    cached,
    usage: result.usage,
    provider: result.provider,
  };
}

export interface RunAIStreamParams extends Omit<RunAIParams, "jsonMode" | "responseSchema" | "forceRefresh" | "cacheable"> {}

/**
 * Streaming entry point. Skips the response cache (streaming responses are
 * for real-time UX, not repeat lookups) but still enforces rate limiting,
 * sanitization, and usage tracking once the stream completes.
 */
export async function* runAIStream(
  params: RunAIStreamParams
): AsyncGenerator<StreamChunk, void, unknown> {
  const requestId = params.requestId ?? makeRequestId();
  const start = Date.now();
  const model = resolveModelForFeature(params.feature);

  await enforceRateLimit(params.userId, params.feature);

  const sanitizedMessages: GeminiMessage[] = params.messages.map((m) => ({
    role: m.role,
    parts: m.parts.map((p) => ("text" in p ? { text: sanitizeInput(p.text).clean } : p)),
  }));

  const genOptions: GenerateOptions = {
    model: model.id,
    systemInstruction: params.systemInstruction,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    requestId,
  };

  let finalText = "";
  let success = true;
  let errorMessage: string | undefined;
  let provider: AIProvider = "gemini";

  try {
    for await (const chunk of streamGenerateWithFallback(sanitizedMessages, {
      ...genOptions,
      feature: params.feature,
    })) {
      finalText = chunk.accumulated;
      if (chunk.provider) provider = chunk.provider;
      yield chunk;
    }
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    await trackUsage({
      requestId,
      userId: params.userId,
      feature: params.feature,
      model: provider === "grok" ? "grok-fallback" : model.id,
      provider,
      promptTokens: 0, // neither provider's SSE stream emits usage per-chunk reliably
      outputTokens: Math.ceil(finalText.length / 4),
      durationMs: Date.now() - start,
      success,
      errorMessage,
    });
    if (provider === "grok") {
      logger.warn("ai.engine.stream_served_by_fallback_provider", {
        requestId,
        feature: params.feature,
        primaryModel: model.id,
      });
    }
  }
}
