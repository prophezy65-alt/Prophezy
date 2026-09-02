/**
 * lib/ai/middleware/cache.ts
 *
 * Redis-backed cache for three things:
 *   - response cache: identical prompt + params -> skip Gemini entirely
 *   - embedding cache: same text -> reuse the vector instead of re-embedding
 *   - generic prompt cache: for anything services want to memoize
 *
 * Keys are content-hashed so cache correctness doesn't depend on callers
 * remembering to invalidate anything.
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import { logger } from "../utils/logger";

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set."
    );
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function hashKey(namespace: string, payload: unknown): string {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
  return `cache:${namespace}:${hash}`;
}

export interface CacheOptions {
  /** Time-to-live in seconds. Default 3600 (1 hour). */
  ttlSeconds?: number;
  /** Skip the cache read (still writes) — useful for a forced "regenerate" action */
  forceRefresh?: boolean;
}

/**
 * Generic memoization wrapper: computes `payload`'s cache key, returns the
 * cached value if present, otherwise calls `compute()`, stores, and returns.
 *
 * Example:
 *   const result = await withCache("response:resume", { userId, prompt }, () =>
 *     generate(messages, opts)
 *   );
 */
export async function withCache<T>(
  namespace: string,
  payload: unknown,
  compute: () => Promise<T>,
  opts: CacheOptions = {}
): Promise<T> {
  const key = hashKey(namespace, payload);
  const redis = getRedis();
  const ttl = opts.ttlSeconds ?? 3600;

  if (!opts.forceRefresh) {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      logger.debug("ai.cache.hit", { namespace, key });
      return cached;
    }
  }

  const result = await compute();
  await redis.set(key, result, { ex: ttl });
  logger.debug("ai.cache.miss", { namespace, key, ttl });
  return result;
}

/** Embedding-specific cache: text -> vector, long TTL since embeddings don't drift. */
export async function withEmbeddingCache(
  text: string,
  compute: () => Promise<number[]>
): Promise<number[]> {
  return withCache("embedding", text, compute, { ttlSeconds: 60 * 60 * 24 * 30 });
}

export async function invalidateCache(namespace: string, payload: unknown): Promise<void> {
  const key = hashKey(namespace, payload);
  await getRedis().del(key);
}
