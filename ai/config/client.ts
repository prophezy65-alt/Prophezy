/**
 * lib/ai/config/client.ts
 *
 * The single low-level entry point for talking to Gemini. Every service in
 * lib/ai/services/* must go through this — never call fetch() to Gemini
 * directly from a service or route handler.
 *
 * Responsibilities:
 *  - build requests against the Gemini REST API (generativelanguage.googleapis.com)
 *  - streaming (SSE) and non-streaming generation
 *  - timeout + AbortController wiring
 *  - retry with backoff (delegated to utils/retry.ts) AND multi-key rotation
 *    (delegated to config/key-manager.ts) — these are two different axes:
 *    retry.ts retries the SAME key/model after a backoff for transient
 *    blips; key-manager rotates to a DIFFERENT key when the current one is
 *    quota-exhausted/invalid/erroring. Both apply within one generate() call.
 *  - multimodal (image/document) parts
 *  - normalizes Gemini's response shape into a stable internal type so the
 *    rest of the app never depends on Google's wire format directly
 *
 * FIX (this file): previously defined its own `getApiKey()` reading only
 * `process.env.GEMINI_API_KEY`, completely bypassing key-manager.ts's
 * multi-key pool (GEMINI_API_KEY_1/_2/_3...). key-manager.ts was fully
 * built and correct, just never imported anywhere — so no matter how many
 * numbered keys were configured, every request always used the same single
 * key, and rotation/cooldown logic never ran. Now wired in for real.
 */

import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import { AIConfigError, AIRequestError, AITimeoutError } from "../utils/errors";
import type { GeminiModelId } from "./models";
import { MODELS, DEFAULT_MODEL } from "./models";
import {
  getKeyOrder,
  reportKeySuccess,
  reportKeyFailure,
  classifyFailure,
  assertKeysConfigured,
  AIAllKeysExhaustedError,
} from "./key-manager";

export { AIConfigError, AIRequestError, AITimeoutError } from "../utils/errors";
export { AIAllKeysExhaustedError } from "./key-manager";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type GeminiRole = "user" | "model";

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export interface GeminiMessage {
  role: GeminiRole;
  parts: GeminiPart[];
}

export interface GenerateOptions {
  model?: GeminiModelId;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  /** Force strict JSON output via Gemini's responseMimeType */
  jsonMode?: boolean;
  /** JSON schema Gemini should conform its output to (only used if jsonMode) */
  responseSchema?: Record<string, unknown>;
  /** Millisecond timeout for the whole request. Default 60_000. */
  timeoutMs?: number;
  /** Max retry attempts on transient failures, PER KEY. Default 2. */
  maxRetries?: number;
  /** Caller-supplied AbortSignal, composed with the internal timeout signal */
  signal?: AbortSignal;
  /** Request id for logging/analytics correlation */
  requestId?: string;
  /**
   * Which feature/module is calling in (e.g. "career", "quiz", "notes").
   * Purely for diagnostic logging here — engine.ts is what actually
   * SELECTS the model via resolveModelForFeature() before calling
   * generate(); this field just lets that decision be correlated with the
   * key/model actually used, in one log line, instead of two separate ones
   * you have to join by requestId.
   */
  feature?: string;
}

export interface GenerateResult {
  text: string;
  finishReason: string | null;
  usage: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  raw: unknown;
}

export interface StreamChunk {
  /** Incremental text delta for this chunk */
  delta: string;
  /** Full accumulated text so far */
  accumulated: string;
  done: boolean;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function buildGenerationConfig(opts: GenerateOptions, modelId: GeminiModelId) {
  const profile = MODELS[modelId];
  return {
    temperature: opts.temperature ?? profile.defaultTemperature,
    maxOutputTokens: opts.maxOutputTokens ?? profile.defaultMaxOutputTokens,
    topP: opts.topP,
    topK: opts.topK,
    ...(opts.jsonMode
      ? {
          responseMimeType: "application/json",
          ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
        }
      : {}),
  };
}

function composeSignal(
  timeoutMs: number,
  callerSignal?: AbortSignal
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new AITimeoutError()), timeoutMs);

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason));
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function extractText(candidate: any): string {
  const parts = candidate?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? "").join("");
}

/** True for errors worth trying a DIFFERENT key for, not just retrying the
 * same one. Deliberately narrower than "any AIRequestError": a 400 from a
 * malformed request (e.g. a bad responseSchema) or a 404 from a wrong
 * model id fails identically on every key in the pool, so rotating
 * through all of them just burns the whole pool on a request that was
 * never going to succeed anywhere. Reuses key-manager's classifyFailure()
 * (already the single source of truth for "is this actually a per-key
 * problem") instead of re-deriving that logic here. */
function isKeyRotationCandidate(err: unknown): boolean {
  if (err instanceof AITimeoutError) return true;
  if (err instanceof AIRequestError) {
    const kind = classifyFailure(err);
    return kind === "quota" || kind === "invalid" || kind === "blocked" || kind === "server";
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Non-streaming generation                                                    */
/* -------------------------------------------------------------------------- */

export async function generate(
  messages: GeminiMessage[],
  opts: GenerateOptions = {}
): Promise<GenerateResult> {
  assertKeysConfigured();

  const modelId = opts.model ?? DEFAULT_MODEL;
  // Deliberately much lower than the old 60_000 default. Your route wraps
  // the whole extractSyllabus() call in its own ~60s stage timeout shared
  // across EVERY key attempt combined (ingestion + all rotations) — not
  // per attempt. With this at 60_000, a single slow/hanging key could burn
  // the entire outer budget by itself (see the "key #3 ... timed out"
  // log after two fast quota rejections still hit the 60s stage timeout),
  // leaving zero time to ever reach a healthy key. Real successful calls
  // for this feature were observed between ~20s-46s, so 25s will abort
  // some calls that would have eventually succeeded — that's intentional:
  // rotating to a fresh, likely-less-loaded key and getting a second ~25s
  // window is more likely to finish inside the outer budget than staking
  // everything on one slow key for its full 60s. If your route's stage
  // timeout is configurable, raising it (e.g. to 90-120s) alongside this
  // will let genuinely-slow-but-healthy calls complete instead of retrying.
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const maxRetries = opts.maxRetries ?? 2;

  const keyOrder = getKeyOrder();
  let lastErr: unknown;

  for (const keyState of keyOrder) {
    try {
      const result = await withRetry(
        async () => {
          const { signal, clear } = composeSignal(timeoutMs, opts.signal);
          const start = Date.now();
          try {
            const url = `${GEMINI_API_BASE}/models/${modelId}:generateContent?key=${keyState.key}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal,
              body: JSON.stringify({
                contents: messages,
                ...(opts.systemInstruction
                  ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
                  : {}),
                generationConfig: buildGenerationConfig(opts, modelId),
              }),
            });

            const json = await res.json();

            if (!res.ok) {
              throw new AIRequestError(
                json?.error?.message ?? `Gemini request failed with status ${res.status}`,
                res.status,
                json
              );
            }

            const candidate = json.candidates?.[0];
            const text = extractText(candidate);
            const usage = json.usageMetadata ?? {};

            logger.info("ai.generate.success", {
              requestId: opts.requestId,
              feature: opts.feature ?? null,
              model: modelId,
              keyLabel: `key #${keyState.index + 1}`,
              durationMs: Date.now() - start,
              promptTokens: usage.promptTokenCount,
              outputTokens: usage.candidatesTokenCount,
            });

            return {
              text,
              finishReason: candidate?.finishReason ?? null,
              usage: {
                promptTokens: usage.promptTokenCount ?? 0,
                outputTokens: usage.candidatesTokenCount ?? 0,
                totalTokens: usage.totalTokenCount ?? 0,
              },
              raw: json,
            };
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              throw new AITimeoutError();
            }
            throw err;
          } finally {
            clear();
          }
        },
        {
          maxRetries,
          onRetry: (attempt, err) =>
            logger.warn("ai.generate.retry", {
              requestId: opts.requestId,
              feature: opts.feature ?? null,
              model: modelId,
              keyLabel: `key #${keyState.index + 1}`,
              attempt,
              error: err instanceof Error ? err.message : String(err),
            }),
        }
      );

      // Full success on this key — cache it as preferred for future calls
      // and stop trying further keys.
      reportKeySuccess(keyState.index);
      return result;
    } catch (err) {
      lastErr = err;

      if (!isKeyRotationCandidate(err)) {
        // Not a key-specific problem (e.g. a bug in our own request
        // construction) — retrying with a different key won't help and
        // would just mask the real error. Fail fast.
        throw err;
      }

      const kind = reportKeyFailure(keyState.index, err);
      logger.warn("ai.generate.key_rotation", {
        requestId: opts.requestId,
        feature: opts.feature ?? null,
        model: modelId,
        exhaustedKeyLabel: `key #${keyState.index + 1}`,
        reason: kind,
        keysRemaining: keyOrder.length - (keyOrder.indexOf(keyState) + 1),
      });
      // fall through to the next key in keyOrder
    }
  }

  logger.error("ai.generate.all_keys_exhausted", {
    requestId: opts.requestId,
    feature: opts.feature ?? null,
    model: modelId,
    keysTried: keyOrder.length,
    // Message only, never the raw error object — a raw fetch()-level
    // failure (DNS/TLS/connection reset, as opposed to our own
    // AIRequestError) can carry the full request URL, which includes
    // ?key=... unmasked, in its cause chain. .message never does.
    lastFailureMessage: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
  throw new AIAllKeysExhaustedError(keyOrder.length);
}

/* -------------------------------------------------------------------------- */
/* Streaming generation                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Streams a Gemini response as an async generator of StreamChunk.
 * Consumers can `for await (const chunk of streamGenerate(...))`.
 * Pass opts.signal to allow cancel/abort from the caller (e.g. a route
 * handler wired to a client "stop generating" button).
 *
 * Key rotation for streaming only happens BEFORE the stream starts
 * (picking which key to open the connection with) — once tokens have
 * started flowing to the caller, switching keys mid-stream isn't safe to
 * do transparently, so a failure after the stream has begun surfaces as an
 * error to the caller rather than silently retrying on a new key.
 */
export async function* streamGenerate(
  messages: GeminiMessage[],
  opts: GenerateOptions = {}
): AsyncGenerator<StreamChunk, void, unknown> {
  assertKeysConfigured();

  const modelId = opts.model ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const keyOrder = getKeyOrder();

  let accumulated = "";
  let lastErr: unknown;

  for (const keyState of keyOrder) {
    const { signal, clear } = composeSignal(timeoutMs, opts.signal);
    accumulated = "";

    try {
      const url = `${GEMINI_API_BASE}/models/${modelId}:streamGenerateContent?alt=sse&key=${keyState.key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: messages,
          ...(opts.systemInstruction
            ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
            : {}),
          generationConfig: buildGenerationConfig(opts, modelId),
        }),
      });

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => null);
        throw new AIRequestError(
          errJson?.error?.message ?? `Gemini stream failed with status ${res.status}`,
          res.status,
          errJson
        );
      }

      // Connection opened successfully on this key — commit to it and log
      // which one, then stream through to the caller.
      reportKeySuccess(keyState.index);
      logger.info("ai.stream.started", {
        requestId: opts.requestId,
        feature: opts.feature ?? null,
        model: modelId,
        keyLabel: `key #${keyState.index + 1}`,
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
            const candidate = json.candidates?.[0];
            const delta = extractText(candidate);
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
        throw new AITimeoutError();
      }

      if (!isKeyRotationCandidate(err)) {
        throw err;
      }

      const kind = reportKeyFailure(keyState.index, err);
      logger.warn("ai.stream.key_rotation", {
        requestId: opts.requestId,
        feature: opts.feature ?? null,
        model: modelId,
        exhaustedKeyLabel: `key #${keyState.index + 1}`,
        reason: kind,
      });
      // fall through to try the next key — connection never opened, so
      // nothing has been yielded to the caller yet, safe to retry.
    } finally {
      clear();
    }
  }

  logger.error("ai.stream.all_keys_exhausted", {
    requestId: opts.requestId,
    feature: opts.feature ?? null,
    model: modelId,
    keysTried: keyOrder.length,
  });
  throw new AIAllKeysExhaustedError(keyOrder.length);
}

/* -------------------------------------------------------------------------- */
/* Embeddings                                                                  */
/* -------------------------------------------------------------------------- */

export async function embed(text: string, requestId?: string): Promise<number[]> {
  assertKeysConfigured();

  const keyOrder = getKeyOrder();
  let lastErr: unknown;

  for (const keyState of keyOrder) {
    try {
      const url = `${GEMINI_API_BASE}/models/gemini-embedding-001:embedContent?key=${keyState.key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // gemini-embedding-001 defaults to 3072 dims; every vector(...) column in
        // this schema is 768 (document_chunks, flashcards, quiz_questions,
        // humanizer, internships, resume-studio, etc — migrating all of them is
        // out of scope for an embedding-model swap), so truncate via
        // outputDimensionality to stay compatible with existing tables/indexes.
        body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new AIRequestError(json?.error?.message ?? "Embedding request failed", res.status, json);
      }
      const values: number[] = json.embedding?.values ?? [];
      // Non-full-dimension output from this model isn't unit-length by default —
      // normalize so cosine-distance (`<=>`) queries against these vectors are
      // correct, not just "close enough".
      const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
      const normalized = norm > 0 ? values.map((v) => v / norm) : values;

      reportKeySuccess(keyState.index);
      logger.info("ai.embed.success", {
        requestId,
        keyLabel: `key #${keyState.index + 1}`,
        dims: normalized.length,
      });
      return normalized;
    } catch (err) {
      lastErr = err;
      if (!isKeyRotationCandidate(err)) throw err;
      reportKeyFailure(keyState.index, err);
      // fall through to next key
    }
  }

  throw new AIAllKeysExhaustedError(keyOrder.length);
}
