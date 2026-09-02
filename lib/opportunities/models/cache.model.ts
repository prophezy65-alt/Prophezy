/**
 * lib/opportunities/models/cache.model.ts
 *
 * Deterministic cache-key construction and the cache entry envelope
 * shared by every cached read path (search results, opportunity detail,
 * facets, provider health, analytics snapshots). Keeping key-building
 * here — rather than inline in each service — guarantees two services
 * asking for "the same thing" always produce the same key.
 */

import { createHash } from "node:crypto";
import { CacheNamespace } from "./enums";
import { ISODateString } from "./shared.model";

export interface CacheEntry<T> {
  readonly value: T;
  readonly cachedAt: ISODateString;
  readonly expiresAt: ISODateString;
}

export function isCacheEntryFresh<T>(entry: CacheEntry<T>, nowISO: ISODateString): boolean {
  return Date.parse(nowISO) < Date.parse(entry.expiresAt);
}

/**
 * Builds a stable cache key from a namespace and an arbitrary JSON-
 * serializable payload (e.g. a `SearchQuery`). Key order in the payload
 * does not matter — keys are sorted before hashing.
 */
export function buildCacheKey(namespace: CacheNamespace, payload: unknown): string {
  const canonical = canonicalize(payload);
  const hash = createHash("sha256").update(canonical).digest("hex");
  return `opportunities:${namespace}:${hash}`;
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Default TTLs per namespace, in seconds. Callers may override per-call for special cases. */
export const DEFAULT_CACHE_TTL_SECONDS: Record<CacheNamespace, number> = {
  [CacheNamespace.SEARCH_RESULTS]: 120,
  [CacheNamespace.OPPORTUNITY_DETAIL]: 600,
  [CacheNamespace.PROVIDER_HEALTH]: 60,
  [CacheNamespace.FACETS]: 300,
  [CacheNamespace.ANALYTICS_SNAPSHOT]: 900,
};
