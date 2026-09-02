/**
 * cache.provider.ts
 * Cache interface (Redis-backed in production) used to avoid re-running
 * expensive AI Core calls (roadmaps, recommendations, analysis) for the
 * same profile snapshot. Injected into services rather than importing a
 * Redis client directly, keeping this module infra-agnostic.
 */

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}

/**
 * In-memory cache used for local dev/tests and as a safe default. Replace
 * with a real Redis-backed CacheProvider in production via DI.
 */
export function createInMemoryCacheProvider(): CacheProvider {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      store.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      });
    },
    async invalidate(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

/**
 * Builds a stable cache key from a namespace and arbitrary parts, so
 * every service uses a consistent key format (easier to invalidate by
 * pattern in real Redis later).
 */
export function buildCacheKey(namespace: string, ...parts: (string | number)[]): string {
  return [namespace, ...parts.map(String)].join(":");
}
