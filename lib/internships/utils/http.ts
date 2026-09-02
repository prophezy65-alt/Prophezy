import { ProviderError, RateLimitError } from './errors';
import { getBucket } from './rate-limiter';
import { withRetry } from './retry';

export interface HttpOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** rate-limit bucket key, normally the provider key */
  bucket?: { key: string; requestsPerMinute: number; minDelayMs: number };
  attempts?: number;
  accept?: 'json' | 'text';
}

const USER_AGENT =
  process.env.INTERNSHIP_USER_AGENT ??
  'ProphezyInternshipBot/1.0 (+https://prophezy.app/bot; contact=support@prophezy.app)';

/**
 * Single egress point for every provider.
 * Enforces timeouts, rate limits, retries and a truthful identifying User-Agent.
 */
export async function httpRequest<T>(
  provider: string,
  url: string,
  options: HttpOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;

  if (options.bucket) {
    await getBucket(options.bucket.key, options.bucket.requestsPerMinute, options.bucket.minDelayMs)
      .acquire(options.signal);
  }

  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = (): void => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: options.accept === 'text' ? 'text/plain, application/xml, text/xml, */*' : 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '0') * 1000;
        throw new RateLimitError(provider, retryAfter > 0 ? retryAfter : 30_000);
      }
      if (!response.ok) {
        const snippet = (await response.text().catch(() => '')).slice(0, 300);
        throw new ProviderError(provider, `HTTP ${response.status} for ${url}`, { snippet });
      }

      if (options.accept === 'text') return (await response.text()) as unknown as T;
      const text = await response.text();
      if (!text.trim()) return [] as unknown as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ProviderError(provider, `Malformed JSON response from ${url}`);
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }, { attempts: options.attempts ?? 3, signal: options.signal });
}

export function buildUrl(base: string, params: Record<string, string | number | boolean | undefined | null>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
