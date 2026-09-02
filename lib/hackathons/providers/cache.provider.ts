/**
 * cache.provider.ts
 * Cache interface (Redis-backed in production) used across the module for
 * hackathon listing caching, AI-generated content caching, and dedupe
 * during provider sync jobs.
 */

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}

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
      store.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    },
    async invalidate(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

export function buildCacheKey(namespace: string, ...parts: (string | number)[]): string {
  return [namespace, ...parts.map(String)].join(":");
}
