/**
 * lib/project-generator/services/ai-core-client.ts
 *
 * The ONLY file in the Project Generator backend that imports
 * `lib/ai/engine.ts`. Every other service depends on the `AICoreClient`
 * interface from `types.ts`; this file provides the real implementation.
 *
 * Responsibilities:
 *   1. Call `runAI()` from the existing AI Core — never Gemini directly.
 *   2. Cache structured responses by a content hash of (featureKey + prompts).
 *   3. Parse + repair JSON, then run the caller's validator.
 *   4. On schema mismatch, retry ONCE with a corrective follow-up prompt
 *      that includes the validation error, before giving up.
 *   5. Log every attempt (start, cache hit/miss, success, failure) as
 *      structured JSON via the injected Logger.
 *   6. Map every failure mode to the shared `GenerationError` shape.
 *
 * Expected shape of `lib/ai/engine.ts` (per the existing AI Core README):
 *
 *   export function runAI(options: {
 *     featureKey: string;
 *     systemPrompt: string;
 *     userPrompt: string;
 *     jsonMode?: boolean;
 *     temperature?: number;
 *     maxOutputTokens?: number;
 *     userId?: string;
 *   }): Promise<{ text: string; modelUsed: string; usage: { inputTokens: number; outputTokens: number } }>;
 *
 * If your actual `runAI` signature differs, this is the single file to
 * adjust — no other service needs to change.
 */

import { createHash } from "node:crypto";
import { runAI } from "@/lib/ai/engine";
import { err, ok, Result, GenerationError } from "../models";
import { toGenerationError } from "./errors";
import { parseJsonWithRepair } from "./json-utils";
import type { AICoreClient, CacheProvider, Logger, MediaExtractionRequest, StructuredAIRequest } from "./types";

const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const MAX_SCHEMA_REPAIR_ATTEMPTS = 3;
// Observed real calls in production logs range from ~20s to ~160s. This is
// a generous outer safety net, not a tuned expectation — its only job is
// to guarantee runStructured() eventually settles instead of hanging
// indefinitely if the underlying AI Core call stalls (no response, no
// error, nothing) for any reason. lib/ai/engine.ts may have its own
// internal timeout already (see isTransportError's "AITimeoutError"
// check below) — this is a belt-and-suspenders backstop specific to this
// client, not a replacement for tuning that.
const AI_CALL_TIMEOUT_MS = 4 * 60 * 1000;

class AICallTimeoutError extends Error {
  readonly name = "AITimeoutError";
  constructor(timeoutMs: number) {
    super(`AI Core call did not respond within ${timeoutMs}ms.`);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AICallTimeoutError(timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function buildCacheKey(featureKey: string, systemPrompt: string, userPrompt: string): string {
  const hash = createHash("sha256").update(systemPrompt).update("\u0000").update(userPrompt).digest("hex");
  return `project-generator:${featureKey}:${hash}`;
}

function buildCorrectivePrompt(originalUserPrompt: string, validationMessage: string, rawResponse: string): string {
  return [
    originalUserPrompt,
    "",
    "---",
    "Your previous response could not be used because it did not match the required JSON schema.",
    `Validation error: ${validationMessage}`,
    "Your previous response was:",
    rawResponse.slice(0, 4000),
    "---",
    "Respond again with ONLY corrected JSON that satisfies the schema above. Do not include any explanation, preamble, or Markdown code fences.",
  ].join("\n");
}

export class EngineAICoreClient implements AICoreClient {
  constructor(private readonly cache: CacheProvider, private readonly logger: Logger) {}

  async runStructured<T>(request: StructuredAIRequest<T>): Promise<Result<T, GenerationError>> {
    const step = `runStructured(${request.featureKey})`;
    const cacheTtl = request.cacheTtlSeconds ?? 0;
    const cacheKey = buildCacheKey(request.featureKey, request.systemPrompt, request.userPrompt);

    if (cacheTtl > 0) {
      try {
        const cached = await this.cache.get<T>(cacheKey);
        if (cached !== null) {
          this.logger.info(`${step}: cache hit`, { featureKey: request.featureKey, cacheKey });
          return ok(cached);
        }
      } catch (cacheReadError) {
        this.logger.warn(`${step}: cache read failed, proceeding without cache`, {
          error: String(cacheReadError),
        });
      }
    }

    let currentUserPrompt = request.userPrompt;
    let lastRawText = "";

    for (let attempt = 1; attempt <= MAX_SCHEMA_REPAIR_ATTEMPTS; attempt += 1) {
      try {
        this.logger.info(`${step}: calling AI Core`, { attempt, userId: request.userId });

        const response = await withTimeout(
          runAI({
            feature: request.featureKey,
            systemInstruction: request.systemPrompt,
            messages: [{ role: "user", parts: [{ text: currentUserPrompt }] }],
            jsonMode: true,
            temperature: request.temperature ?? DEFAULT_TEMPERATURE,
            maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
            userId: request.userId,
          }),
          AI_CALL_TIMEOUT_MS
        );

        lastRawText = response.text;
        const rawJson = parseJsonWithRepair(response.text);
        const parsed = request.parse(rawJson);

        if (cacheTtl > 0) {
          try {
            await this.cache.set(cacheKey, parsed, cacheTtl);
          } catch (cacheWriteError) {
            this.logger.warn(`${step}: cache write failed`, { error: String(cacheWriteError) });
          }
        }

        this.logger.info(`${step}: succeeded`, {
          attempt,
          inputTokens: response.usage.promptTokens,
          outputTokens: response.usage.outputTokens,
        });

        return ok(parsed);
      } catch (error) {
        const isLastAttempt = attempt === MAX_SCHEMA_REPAIR_ATTEMPTS;
        const isSchemaIssue = error instanceof Error && !isTransportError(error);

        this.logger.warn(`${step}: attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : String(error),
          willRetry: isSchemaIssue && !isLastAttempt,
        });

        if (!isSchemaIssue || isLastAttempt) {
          return err(toGenerationError(error, { step }));
        }

        currentUserPrompt = buildCorrectivePrompt(
          request.userPrompt,
          error instanceof Error ? error.message : String(error),
          lastRawText
        );
      }
    }

    return err(toGenerationError(new Error("Exhausted schema repair attempts."), { step }));
  }

  async extractTextFromMedia(request: MediaExtractionRequest): Promise<Result<string, GenerationError>> {
    const step = `extractTextFromMedia(${request.featureKey})`;
    try {
      this.logger.info(`${step}: calling AI Core for multimodal extraction`, {
        storagePath: request.storagePath,
        mimeType: request.mimeType,
      });

      const response = await withTimeout(
        runAI({
          feature: request.featureKey,
          systemInstruction:
            "You extract clean, well-structured plain text from the provided file for downstream processing. " +
            "Output ONLY the extracted text — no commentary, no JSON, no Markdown fences.",
          messages: [{ role: "user", parts: [{ text: `${request.instructions}\n\nFile reference: ${request.storagePath} (${request.mimeType})` }] }],
          jsonMode: false,
          temperature: 0.1,
          maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
          userId: request.userId,
        }),
        AI_CALL_TIMEOUT_MS
      );

      const text = response.text.trim();
      if (text.length === 0) {
        return err(toGenerationError(new Error("AI Core returned empty extracted text."), { step }));
      }

      this.logger.info(`${step}: succeeded`, { extractedChars: text.length });
      return ok(text);
    } catch (error) {
      return err(toGenerationError(error, { step }));
    }
  }
}

/** Transport/infra failures should not trigger a corrective-prompt retry — only schema mismatches should. */
function isTransportError(error: Error): boolean {
  return (
    error.name === "AITimeoutError" ||
    error.name === "AISafetyBlockedError" ||
    error.name === "AIRequestError"
  );
}
