/**
 * lib/research/utils/errors.ts
 *
 * Typed error hierarchy for the Research AI Backend. Mirrors the
 * shape of lib/ai/utils/errors.ts (AIRequestError, AITimeoutError, ...)
 * so both subsystems fail in a consistent, catchable way.
 */

export class ResearchError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a provider HTTP call fails (network error, non-2xx, malformed body). */
export class ProviderRequestError extends ResearchError {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly statusCode?: number,
    cause?: unknown,
  ) {
    super(`[${provider}] ${message}`, 'PROVIDER_REQUEST_ERROR', cause);
  }
}

/** Thrown when a provider call exceeds its timeout budget. */
export class ProviderTimeoutError extends ResearchError {
  constructor(
    public readonly provider: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `[${provider}] request timed out after ${timeoutMs}ms`,
      'PROVIDER_TIMEOUT_ERROR',
    );
  }
}

/** Thrown when a provider signals rate limiting (HTTP 429 or documented equivalent). */
export class ProviderRateLimitError extends ResearchError {
  constructor(
    public readonly provider: string,
    public readonly retryAfterMs?: number,
  ) {
    super(`[${provider}] rate limited`, 'PROVIDER_RATE_LIMIT_ERROR');
  }
}

/** Thrown when input fails validation before a provider or service call is made. */
export class ResearchValidationError extends ResearchError {
  constructor(message: string, public readonly issues: string[]) {
    super(message, 'RESEARCH_VALIDATION_ERROR');
  }
}

/** Thrown when every registered provider for a search failed. */
export class AllProvidersFailedError extends ResearchError {
  constructor(public readonly failures: Record<string, string>) {
    super(
      `All providers failed: ${Object.entries(failures)
        .map(([p, e]) => `${p} (${e})`)
        .join(', ')}`,
      'ALL_PROVIDERS_FAILED',
    );
  }
}

export function isResearchError(err: unknown): err is ResearchError {
  return err instanceof ResearchError;
}
