/**
 * lib/project-generator/services/types.ts
 *
 * Dependency-injection contracts shared by every service in this module.
 * Services never import `lib/ai/engine.ts` (or Redis, or a clock) directly —
 * they receive an `AICoreClient`, `CacheProvider`, `Logger`, `Clock` and
 * `IdGenerator` through a `ServiceContext`. This keeps every service pure,
 * unit-testable, and decoupled from concrete infra so the AI Core, cache
 * backend, or logger can change without touching a single service body.
 */

import { GenerationError } from "../models";

/** Minimal structured logger contract. Adapt `lib/ai/utils/logger.ts` to this shape. */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/** Minimal cache contract. Adapt `lib/ai/middleware/cache.ts` (Upstash Redis) to this shape. */
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Clock {
  nowISO(): string;
  nowMs(): number;
}

export interface IdGenerator {
  newId(): string;
}

/**
 * Everything a project-generator service needs to call the AI Core.
 * `runStructured` is the ONLY entry point services use to reach the AI Core —
 * mirroring the existing `services/_run-structured.ts` pattern already used
 * by the rest of the codebase (resume.service.ts, ats.service.ts, etc.).
 * The concrete implementation lives in `ai-core-client.ts` and wraps
 * `lib/ai/engine.ts`'s `runAI()` — it never calls Gemini directly.
 */
export interface AICoreClient {
  /**
   * Sends a system+user prompt to the AI Core in JSON mode, parses and
   * validates the response against the given validator, retries once with
   * a corrective follow-up prompt on schema mismatch, and returns a typed
   * Result instead of throwing across module boundaries.
   */
  runStructured<T>(request: StructuredAIRequest<T>): Promise<import("../models").Result<T, GenerationError>>;

  /**
   * Sends a multimodal (file/image/audio) extraction request to the AI Core
   * and returns extracted plain text. Used by source-parser.service.ts for
   * PDF, research paper, image, voice and flowchart sources.
   */
  extractTextFromMedia(request: MediaExtractionRequest): Promise<import("../models").Result<string, GenerationError>>;
}

export interface StructuredAIRequest<T> {
  /** Routes to the right model tier + rate-limit bucket in the AI Core (e.g. "project-generator.spec"). */
  readonly featureKey: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly userId: string;
  /** Parses+validates the raw JSON payload into T; throws a descriptive Error on failure. */
  readonly parse: (raw: unknown) => T;
  /** Cache TTL in seconds. Omit or pass 0 to disable caching for this call. */
  readonly cacheTtlSeconds?: number;
}

export interface MediaExtractionRequest {
  readonly featureKey: string;
  readonly storagePath: string;
  readonly mimeType: string;
  readonly instructions: string;
  readonly userId: string;
}

export interface ServiceContext {
  readonly aiCore: AICoreClient;
  readonly cache: CacheProvider;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
