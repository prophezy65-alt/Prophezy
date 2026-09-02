/**
 * lib/ai/utils/retry.ts
 *
 * Generic retry-with-backoff wrapper used by config/client.ts. Retries only
 * on transient failures (timeouts, 429, 5xx) — never retries on 400/401/403
 * since retrying a bad request just burns quota for the same failure.
 */

import { AIRequestError, AITimeoutError } from "./errors";

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

function isRetryable(err: unknown): boolean {
  // Neither 429 (quota) nor our own client-side timeout are retried on the
  // SAME key/connection here — both cases mean "this key/attempt is not
  // going to succeed on a quick retry", and key-manager.ts already rotates
  // to a different key immediately once this bubbles up. Retrying in place
  // just burns wall-clock time (up to a full extra timeoutMs) on an outer
  // caller that typically has a hard stage budget (e.g. a 60s request
  // timeout) shared across ALL key attempts combined — see client.ts for
  // the fuller writeup on why one hung key must not eat the whole budget.
  if (err instanceof AITimeoutError) return false;
  if (err instanceof AIRequestError) {
    if (err.status === 429) return false;
    if (err.status && err.status >= 500) return true;
    return false;
  }
  // Network-level failures (fetch throwing TypeError, ECONNRESET, etc.)
  return true;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 8_000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !isRetryable(err)) {
        throw err;
      }

      const jitter = Math.random() * 0.3 + 0.85; // 0.85x - 1.15x
      const backoff = Math.min(baseDelayMs * 2 ** attempt * jitter, maxDelayMs);

      opts.onRetry?.(attempt + 1, err);
      await delay(backoff);
    }
  }

  // Unreachable, but keeps TypeScript happy.
  throw lastError;
}
