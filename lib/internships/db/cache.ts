import { getEnv } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.cache');

interface UpstashResult<T> { result: T }

/**
 * Upstash Redis REST cache with an in-memory fallback so local dev and CI work
 * without Redis configured. Failures never propagate — a cache miss is not an error.
 */
class Cache {
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();

  private get rest(): { url: string; token: string } | null {
    const env = getEnv();
    return env.redisUrl && env.redisToken ? { url: env.redisUrl, token: env.redisToken } : null;
  }

  private async command<T>(parts: string[]): Promise<T | null> {
    const rest = this.rest;
    if (!rest) return null;
    try {
      const response = await fetch(`${rest.url}/${parts.map(encodeURIComponent).join('/')}`, {
        headers: { Authorization: `Bearer ${rest.token}` },
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const body = (await response.json()) as UpstashResult<T>;
      return body.result;
    } catch (error) {
      log.warn('cache command failed', { error: (error as Error).message });
      return null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const remote = await this.command<string | null>(['get', key]);
    if (remote) return safeParse<T>(remote);

    const local = this.memory.get(key);
    if (local && local.expiresAt > Date.now()) return safeParse<T>(local.value);
    if (local) this.memory.delete(key);
    return null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    this.memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1_000 });
    if (this.memory.size > 2_000) this.evict();
    await this.command(['set', key, serialized, 'ex', String(ttlSeconds)]);
  }

  async del(pattern: string): Promise<void> {
    for (const key of this.memory.keys()) {
      if (key.startsWith(pattern)) this.memory.delete(key);
    }
    await this.deleteByPrefixRemote(pattern);
  }

  /**
   * Upstash/Redis `DEL` takes exact key names, not a prefix — `DEL foo` never
   * matches `foo:abc123`. Real cache keys are always `<pattern>:<hash>`
   * (see cacheKey() below), so the previous `this.command(['del', pattern])`
   * silently matched nothing on any deployment with Redis actually configured
   * (it only appeared to work in local dev, where no REST backend exists and
   * the in-memory branch above — which does correctly prefix-match — was
   * doing all the work). This walks the keyspace with SCAN and deletes the
   * real matching keys.
   */
  private async deleteByPrefixRemote(prefix: string): Promise<void> {
    const rest = this.rest;
    if (!rest) return;

    try {
      let cursor = '0';
      const keysToDelete: string[] = [];

      do {
        const result = await this.command<[string, string[]]>([
          'scan', cursor, 'match', `${prefix}*`, 'count', '200',
        ]);
        if (!result) break;
        const [nextCursor, keys] = result;
        keysToDelete.push(...keys);
        cursor = nextCursor;
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await this.command(['del', ...keysToDelete]);
      }
    } catch (error) {
      log.warn('cache prefix delete failed', { prefix, error: (error as Error).message });
    }
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.memory) {
      if (entry.expiresAt <= now) this.memory.delete(key);
    }
  }

  /** Read-through helper. */
  async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

function safeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const cache = new Cache();

export function cacheKey(namespace: string, parts: Record<string, unknown>): string {
  const stable = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${JSON.stringify(parts[k] ?? null)}`)
    .join('&');
  return `internships:${namespace}:${Buffer.from(stable).toString('base64url').slice(0, 180)}`;
}
