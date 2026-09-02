import { sleep } from './retry';

/**
 * In-process token bucket + minimum spacing.
 * One instance per provider; the sync worker is single-process per run, which is
 * sufficient for provider-side limits. Cross-process limits use the Redis limiter
 * already present in `lib/ai/middleware/rate-limit.ts`.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private lastCall = 0;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMinute: number,
    private readonly minDelayMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMinutes = (now - this.lastRefill) / 60_000;
    if (elapsedMinutes <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedMinutes * this.refillPerMinute);
    this.lastRefill = now;
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    for (;;) {
      this.refill();
      const spacing = this.lastCall + this.minDelayMs - Date.now();
      if (this.tokens >= 1 && spacing <= 0) {
        this.tokens -= 1;
        this.lastCall = Date.now();
        return;
      }
      const waitForToken = this.tokens >= 1 ? 0 : Math.ceil((60_000 / this.refillPerMinute));
      await sleep(Math.max(spacing, waitForToken, 25), signal);
    }
  }
}

const buckets = new Map<string, TokenBucket>();

export function getBucket(key: string, requestsPerMinute: number, minDelayMs: number): TokenBucket {
  const existing = buckets.get(key);
  if (existing) return existing;
  const bucket = new TokenBucket(Math.max(1, Math.ceil(requestsPerMinute / 2)), requestsPerMinute, minDelayMs);
  buckets.set(key, bucket);
  return bucket;
}
