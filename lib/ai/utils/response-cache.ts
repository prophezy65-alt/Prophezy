/**
 * lib/ai/utils/response-cache.ts
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * At 5,000 users, the same Gemini call happens over and over: a hundred
 * students summarizing the same widely-assigned paper, dozens generating
 * a roadmap for "become a data analyst," etc. Every one of those repeats
 * was, until now, a fresh Gemini call — burning quota and money for output
 * that's already been generated. This is the highest-leverage fix
 * available purely in code (no billing change required): cache the
 * output, keyed by exactly what determines the output, and skip Gemini
 * entirely on a hit.
 *
 * Uses the Upstash Redis REST credentials already sitting in `.env`
 * (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) — provisioned but,
 * as far as I can tell from what's been shared with me, not used by any
 * code yet. Requires `@upstash/redis` — if it's not already a dependency:
 * `npm install @upstash/redis`.
 *
 * ============================================================================
 * WHAT THIS DOES NOT DO
 * ============================================================================
 * This does not touch key-manager.ts, key rotation, or the credit system.
 * A cache HIT still means the feature "ran" from the caller's point of
 * view — whether a cache hit should still cost credits is a product
 * decision for you, not something this file decides; each call site
 * chooses (see the two research service integrations below, which spend
 * credits on both hit and miss, since the student still received the
 * value — only the miss triggers Gemini spend on Prophezy's side).
 */
import "server-only";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { logger } from "../utils/logger";

let client: Redis | null = null;
let disabledLogged = false;

function getClient(): Redis | null {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!disabledLogged) {
      logger.warn("ai.cache.disabled", { reason: "UPSTASH_REDIS_REST_URL/TOKEN not set" });
      disabledLogged = true;
    }
    return null;
  }

  client = new Redis({ url, token });
  return client;
}

/** Builds a stable cache key from whatever actually determines the output
 *  — feature name, model id, and a hash of the real input content (NOT
 *  the requesting user's id — two different students asking for the same
 *  paper's summary should share one cache entry). */
export function buildCacheKey(feature: string, model: string, input: unknown): string {
  const serialized = typeof input === "string" ? input : JSON.stringify(input);
  const hash = createHash("sha256").update(serialized).digest("hex").slice(0, 32);
  return `ai:cache:${feature}:${model}:${hash}`;
}

export interface CachedResult<T> {
  value: T;
  cachedAt: string;
}

/**
 * Returns a cached value if present, else runs `compute()`, caches the
 * result for `ttlSeconds`, and returns it. Cache errors (Redis down,
 * misconfigured) fail OPEN — always fall through to `compute()` — a
 * caching layer must never be why a feature stops working.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<{ result: T; cacheHit: boolean }> {
  const redis = getClient();
  if (!redis) return { result: await compute(), cacheHit: false };

  try {
    const cached = await redis.get<CachedResult<T>>(key);
    if (cached) {
      logger.info("ai.cache.hit", { key });
      return { result: cached.value, cacheHit: true };
    }
  } catch (err) {
    logger.warn("ai.cache.read_failed", { key, error: err instanceof Error ? err.message : String(err) });
  }

  const result = await compute();

  try {
    const payload: CachedResult<T> = { value: result, cachedAt: new Date().toISOString() };
    await redis.set(key, payload, { ex: ttlSeconds });
  } catch (err) {
    logger.warn("ai.cache.write_failed", { key, error: err instanceof Error ? err.message : String(err) });
  }

  return { result, cacheHit: false };
}

/** Common TTLs — named so call sites don't invent magic numbers. Paper
 *  summaries/citations are effectively immutable (same paper text in ->
 *  same structured output out), so they get a long TTL; anything more
 *  conversational (chat) should never be cached at all — see chat.service.ts,
 *  intentionally NOT wired to this file. */
export const CACHE_TTL = {
  PAPER_SUMMARY: 60 * 60 * 24 * 30, // 30 days
  PAPER_CITATIONS: 60 * 60 * 24 * 30, // 30 days
  KNOWLEDGE_GRAPH: 60 * 60 * 24 * 7, // 7 days — paper set combinations are more varied, shorter TTL bounds staleness
} as const;
