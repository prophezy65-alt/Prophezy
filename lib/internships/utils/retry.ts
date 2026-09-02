import { isTransient, RateLimitError } from './errors';

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  signal?: AbortSignal;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Exponential backoff. Retries transient failures only — never a 4xx that will fail again. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const base = options.baseDelayMs ?? 500;
  const max = options.maxDelayMs ?? 15_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransient(error)) throw error;

      const explicit = error instanceof RateLimitError
        ? Number(error.context.retryAfterMs ?? 0)
        : 0;
      const backoff = Math.min(max, base * 2 ** (attempt - 1));
      const jitter = options.jitter === false ? 1 : 0.75 + Math.random() * 0.5;
      const delay = Math.max(explicit, Math.round(backoff * jitter));

      options.onRetry?.(error, attempt, delay);
      await sleep(delay, options.signal);
    }
  }
  throw lastError;
}

/** Bounded-concurrency map that never rejects the whole batch on one failure. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = { ok: true, value: await fn(items[index] as T, index) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  });

  await Promise.all(workers);
  return results;
}
