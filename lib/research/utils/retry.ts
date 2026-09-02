/**
 * lib/research/utils/retry.ts
 *
 * Exponential backoff retry helper. Only retries errors flagged as
 * transient (timeouts, 429s, 5xx) — never retries validation errors
 * or 4xx client errors other than 429, since retrying those just
 * burns quota for no benefit.
 */

import {
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderRequestError,
} from './errors';

export interface RetryOptions {
  maxAttempts?: number; // total attempts including the first, default 3
  baseDelayMs?: number; // default 300
  maxDelayMs?: number; // default 5000
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULTS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 5000,
};

function isTransient(error: unknown): boolean {
  if (error instanceof ProviderTimeoutError) return true;
  if (error instanceof ProviderRateLimitError) return true;
  if (error instanceof ProviderRequestError) {
    // Retry on 5xx and 429; not on other 4xx (bad request, not found, etc.)
    if (error.statusCode === undefined) return true; // network-level failure
    return error.statusCode >= 500 || error.statusCode === 429;
  }
  return false;
}

function computeDelay(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * 2 ** (attempt - 1));
  // full jitter
  return Math.floor(Math.random() * exp);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = { ...DEFAULTS, ...options };

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const attemptsRemaining = attempt < maxAttempts;
      if (!attemptsRemaining || !isTransient(err)) {
        throw err;
      }
      const retryAfterMs =
        err instanceof ProviderRateLimitError ? err.retryAfterMs : undefined;
      const delayMs =
        retryAfterMs ?? computeDelay(attempt, baseDelayMs, maxDelayMs);
      options.onRetry?.(attempt, err, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable, but keeps TS happy and guards against future edits.
  throw lastError;
}
