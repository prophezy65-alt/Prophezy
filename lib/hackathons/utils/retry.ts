/**
 * retry.ts
 * Exponential backoff retry helper for AI Core and provider adapter calls.
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 300, backoffFactor = 2, shouldRetry = () => true } = options;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !shouldRetry(error)) throw error;
      await sleep(delay);
      delay *= backoffFactor;
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
