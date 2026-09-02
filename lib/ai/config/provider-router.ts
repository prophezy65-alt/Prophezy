/**
 * lib/ai/config/provider-router.ts
 *
 * THE fallback wiring point. engine.ts calls generateWithFallback() /
 * streamGenerateWithFallback() instead of calling config/client.ts
 * (Gemini) directly. Everything else in engine.ts — rate limiting,
 * response caching, input sanitization, safety checks, JSON parsing,
 * usage tracking — is completely unchanged and sits outside this file, so
 * it applies identically no matter which provider ends up answering.
 *
 * Flow:
 *   1. Try Gemini via config/client.ts (full key rotation + cooldown,
 *      untouched).
 *   2. If Gemini's OWN key pool is exhausted/misconfigured, or the request
 *      timed out, or Gemini's API itself errored (5xx/429/network) —
 *      i.e. Gemini could not produce an answer, not "the answer it gave
 *      was unsafe or malformed" — automatically retry the SAME request
 *      against Grok via config/grok-client.ts (its own independent key
 *      rotation + cooldown).
 *   3. Return a normal GenerateResult either way, tagged with which
 *      provider actually answered. Callers (engine.ts) don't branch on
 *      this except for logging/analytics — the feature never sees a
 *      different code path depending on provider.
 *
 * Deliberately NOT a fallback trigger (rethrown immediately, no Grok
 * attempt):
 *   - AISafetyBlockedError — Gemini answered; its own safety filter
 *     rejected the content. That's a property of the request, not of
 *     Gemini's availability, and Grok has its own separate content
 *     policy, so silently re-routing a safety-blocked prompt to a
 *     different provider is a policy decision this file does not make on
 *     its own.
 *   - AIValidationError — happens in engine.ts AFTER a provider already
 *     returned text; out of scope for this file entirely.
 *   - RateLimitExceededError — this is Prophezy's OWN per-user budget,
 *     enforced by engine.ts BEFORE it ever calls into this router. It is
 *     never seen here, and must never trigger a Grok call — the whole
 *     point of that limiter is to bound spend per user regardless of
 *     provider.
 */

import {
  generate as generateGemini,
  streamGenerate as streamGenerateGemini,
  type GeminiMessage,
  type GenerateOptions,
  type GenerateResult,
  type StreamChunk,
  AIAllKeysExhaustedError,
} from "./client";
import { AIConfigError, AIRequestError, AISafetyBlockedError, AITimeoutError } from "../utils/errors";
import { generateGrok, streamGenerateGrok } from "./grok-client";
import { grokConfigured } from "./grok-key-manager";
import { resolveGrokModel } from "./grok-models";
import { logger } from "../utils/logger";

export type AIProvider = "gemini" | "grok";

export interface ProviderResult extends GenerateResult {
  provider: AIProvider;
  /** The actual model id used to serve this request, whichever provider answered. */
  modelUsed: string;
}

export class AllProvidersUnavailableError extends Error {
  constructor(public geminiError: unknown, public grokError: unknown) {
    super(
      "Gemini and Grok were both unable to serve this request after all fallback rounds. " +
        `Last Gemini failure: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}. ` +
        `Last Grok failure: ${grokError instanceof Error ? grokError.message : String(grokError)}.`
    );
    this.name = "AllProvidersUnavailableError";
  }
}

/**
 * True for errors that mean "Gemini itself could not serve this request"
 * (exhausted/rate-limited/misconfigured/timed out/erroring) as opposed to
 * "Gemini served it and something else about the response was the issue."
 * This is the single decision point for "should we hand this off to Grok".
 */
function isGeminiUnavailable(err: unknown): boolean {
  if (err instanceof AISafetyBlockedError) return false; // Gemini answered; content was blocked — not an availability problem
  if (err instanceof AIAllKeysExhaustedError) return true; // every Gemini key rate-limited/invalid/blocked/erroring
  if (err instanceof AIConfigError) return true; // no Gemini key configured at all
  if (err instanceof AITimeoutError) return true;
  if (err instanceof AIRequestError) return true; // Gemini responded with an error status
  // Anything else escaping generate()/streamGenerate() at this point is a
  // raw, unclassified failure (e.g. DNS/network failure before Gemini's
  // API was even reached) — that's still "Gemini unavailable" in the
  // plain-English sense the fallback is meant to cover.
  return true;
}

function logFallback(feature: string, requestId: string | undefined, reason: unknown) {
  logger.warn("ai.provider_router.falling_back_to_grok", {
    feature,
    requestId,
    geminiFailure: reason instanceof Error ? reason.message : String(reason),
  });
}

/* -------------------------------------------------------------------------- */
/* Non-streaming                                                              */
/* -------------------------------------------------------------------------- */

/**
 * How many full Gemini<->Grok alternations to attempt before giving up.
 * A "round" = one full pass through generateGemini() (which itself already
 * tries every configured Gemini key) followed, on failure, by one full pass
 * through generateGrok() (every configured Grok key). With 3 rounds that's
 * up to 6 total provider attempts. Deliberately bounded, not infinite —
 * an unbounded loop risks hanging the request indefinitely during a real
 * outage, which just gets killed by your host's function timeout anyway
 * with zero benefit to the user. Override via opts.maxFallbackRounds if
 * you want more/fewer alternations.
 */
const DEFAULT_MAX_FALLBACK_ROUNDS = 3;

export async function generateWithFallback(
  messages: GeminiMessage[],
  opts: GenerateOptions & { feature: string; maxFallbackRounds?: number }
): Promise<ProviderResult> {
  const maxRounds = opts.maxFallbackRounds ?? DEFAULT_MAX_FALLBACK_ROUNDS;
  let lastGeminiErr: unknown;
  let lastGrokErr: unknown;

  for (let round = 1; round <= maxRounds; round++) {
    try {
      const result = await generateGemini(messages, opts);
      return { ...result, provider: "gemini", modelUsed: opts.model ?? "gemini" };
    } catch (geminiErr) {
      lastGeminiErr = geminiErr;

      if (!isGeminiUnavailable(geminiErr)) throw geminiErr;

      if (!grokConfigured()) {
        // No Grok keys set up — nothing to fall over to at all. Byte-for-byte
        // same behavior as before this file existed.
        throw geminiErr;
      }

      logFallback(opts.feature, opts.requestId, geminiErr);
    }

    try {
      const grokProfile = resolveGrokModel(opts.feature);
      const grokResult = await generateGrok(messages, {
        model: grokProfile.id,
        systemInstruction: opts.systemInstruction,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        jsonMode: opts.jsonMode,
        timeoutMs: opts.timeoutMs,
        signal: opts.signal,
        requestId: opts.requestId,
        feature: opts.feature,
      });

      logger.info("ai.provider_router.grok_fallback_success", {
        feature: opts.feature,
        requestId: opts.requestId,
        model: grokProfile.id,
        round,
      });

      return { ...grokResult, provider: "grok", modelUsed: grokProfile.id };
    } catch (grokErr) {
      lastGrokErr = grokErr;
      logger.warn("ai.provider_router.round_failed", {
        feature: opts.feature,
        requestId: opts.requestId,
        round,
        maxRounds,
        geminiFailure: lastGeminiErr instanceof Error ? lastGeminiErr.message : String(lastGeminiErr),
        grokFailure: grokErr instanceof Error ? grokErr.message : String(grokErr),
      });
      // Loop continues -> next round tries Gemini again. Any Gemini/Grok
      // keys that were on a short cooldown (e.g. the 60s quota cooldown)
      // may have cleared by the time we come back around, especially
      // under real concurrent load where other requests are also
      // reporting successes and resetting cooldowns.
    }
  }

  logger.error("ai.provider_router.all_rounds_exhausted", {
    feature: opts.feature,
    requestId: opts.requestId,
    maxRounds,
    geminiFailure: lastGeminiErr instanceof Error ? lastGeminiErr.message : String(lastGeminiErr),
    grokFailure: lastGrokErr instanceof Error ? lastGrokErr.message : String(lastGrokErr),
  });
  throw new AllProvidersUnavailableError(lastGeminiErr, lastGrokErr);
}

/* -------------------------------------------------------------------------- */
/* Streaming                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Streaming fallback follows the same "only swap before any bytes have
 * reached the caller" rule config/client.ts already documents for Gemini's
 * own key rotation: if the Gemini stream throws before yielding a single
 * chunk, it's safe to silently retry the whole request against Grok. If it
 * fails AFTER partial output has already been streamed to the user, we
 * cannot un-send those bytes, so the error is surfaced as-is instead of
 * splicing a second provider's output onto the first's.
 */
export async function* streamGenerateWithFallback(
  messages: GeminiMessage[],
  opts: GenerateOptions & { feature: string; maxFallbackRounds?: number }
): AsyncGenerator<StreamChunk & { provider?: AIProvider }, void, unknown> {
  const maxRounds = opts.maxFallbackRounds ?? DEFAULT_MAX_FALLBACK_ROUNDS;
  let lastGeminiErr: unknown;
  let lastGrokErr: unknown;

  for (let round = 1; round <= maxRounds; round++) {
    let yieldedAny = false;
    try {
      for await (const chunk of streamGenerateGemini(messages, opts)) {
        yieldedAny = true;
        yield { ...chunk, provider: "gemini" };
      }
      return;
    } catch (geminiErr) {
      lastGeminiErr = geminiErr;

      if (yieldedAny) {
        // Real bytes already reached the caller — can't un-send them, so
        // surface the error as-is rather than trying another provider
        // mid-stream.
        throw geminiErr;
      }
      if (!isGeminiUnavailable(geminiErr) || !grokConfigured()) {
        throw geminiErr;
      }

      logFallback(opts.feature, opts.requestId, geminiErr);
    }

    let grokYieldedAny = false;
    try {
      const grokProfile = resolveGrokModel(opts.feature);
      for await (const chunk of streamGenerateGrok(messages, {
        model: grokProfile.id,
        systemInstruction: opts.systemInstruction,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        timeoutMs: opts.timeoutMs,
        signal: opts.signal,
        requestId: opts.requestId,
        feature: opts.feature,
      })) {
        grokYieldedAny = true;
        yield { ...chunk, provider: "grok" };
      }
      logger.info("ai.provider_router.grok_stream_fallback_success", {
        feature: opts.feature,
        requestId: opts.requestId,
        round,
      });
      return;
    } catch (grokErr) {
      lastGrokErr = grokErr;

      if (grokYieldedAny) {
        throw grokErr;
      }

      logger.warn("ai.provider_router.stream_round_failed", {
        feature: opts.feature,
        requestId: opts.requestId,
        round,
        maxRounds,
        geminiFailure: lastGeminiErr instanceof Error ? lastGeminiErr.message : String(lastGeminiErr),
        grokFailure: grokErr instanceof Error ? grokErr.message : String(grokErr),
      });
      // Loop continues -> next round tries Gemini again from the top.
    }
  }

  logger.error("ai.provider_router.all_rounds_exhausted_stream", {
    feature: opts.feature,
    requestId: opts.requestId,
    maxRounds,
    geminiFailure: lastGeminiErr instanceof Error ? lastGeminiErr.message : String(lastGeminiErr),
    grokFailure: lastGrokErr instanceof Error ? lastGrokErr.message : String(lastGrokErr),
  });
  throw new AllProvidersUnavailableError(lastGeminiErr, lastGrokErr);
}
