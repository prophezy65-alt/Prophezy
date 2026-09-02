/**
 * lib/document/cache/cache.service.ts
 *
 * ASSUMPTION: your README describes `lib/ai/middleware/cache.ts` as
 * "Upstash Redis response/embedding cache, content-hashed keys." This
 * mirrors that same convention (Upstash Redis client, content-hashed keys)
 * for document-processing results specifically — re-processing an
 * already-seen file (same content hash) should skip parsing/OCR/AI calls
 * entirely. If `withCache()` from `lib/ai/middleware/cache.ts` already
 * covers this generically, prefer importing that instead of this file.
 *
 * Falls back to an in-memory Map if `@upstash/redis` isn't configured, so
 * this doesn't hard-fail in local dev without Redis env vars — it just
 * loses cross-instance sharing.
 */

import { createHash } from "crypto";
import { DocumentError } from "../errors/document-errors";

const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

let redisClient: any = null;
let redisInitAttempted = false;

async function getRedisClient(): Promise<any | null> {
  if (redisInitAttempted) return redisClient;
  redisInitAttempted = true;

  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redisClient;
  } catch {
    return null; // @upstash/redis not installed — fall back to memory cache silently
  }
}

export function hashFileContent(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function cacheKey(namespace: string, contentHash: string): string {
  return `document:${namespace}:${contentHash}`;
}

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const redis = await getRedisClient();
    if (redis) {
      try {
        const value = await redis.get(key);
        return (value as T) ?? null;
      } catch (err) {
        throw new DocumentError("Redis cache read failed.", "CACHE_ERROR", { cause: err instanceof Error ? err.message : String(err) });
      }
    }

    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  },

  async set<T>(key: string, value: T, ttlSeconds = 60 * 60 * 24 * 7): Promise<void> {
    const redis = await getRedisClient();
    if (redis) {
      try {
        await redis.set(key, value, { ex: ttlSeconds });
        return;
      } catch (err) {
        throw new DocumentError("Redis cache write failed.", "CACHE_ERROR", { cause: err instanceof Error ? err.message : String(err) });
      }
    }

    memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },

  async delete(key: string): Promise<void> {
    const redis = await getRedisClient();
    if (redis) {
      await redis.del(key);
      return;
    }
    memoryCache.delete(key);
  },

  /** Wraps a computation with cache-or-compute-and-store, mirroring lib/ai/middleware/cache.ts's withCache(). */
  async withCache<T>(key: string, compute: () => Promise<T>, ttlSeconds?: number): Promise<{ value: T; cached: boolean }> {
    const existing = await this.get<T>(key);
    if (existing !== null) return { value: existing, cached: true };

    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return { value, cached: false };
  },
};
