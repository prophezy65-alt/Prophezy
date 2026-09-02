export class EngineError extends Error {
  readonly code: string;
  readonly status: number;
  readonly context: Record<string, unknown>;

  constructor(code: string, message: string, status = 500, context: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.context = context;
    Error.captureStackTrace?.(this, new.target);
  }

  toJSON(): Record<string, unknown> {
    return { code: this.code, message: this.message, status: this.status, context: this.context };
  }
}

export class ProviderError extends EngineError {
  constructor(provider: string, message: string, context: Record<string, unknown> = {}) {
    super('PROVIDER_ERROR', `[${provider}] ${message}`, 502, { provider, ...context });
  }
}

export class ProviderUnsupportedError extends EngineError {
  constructor(provider: string, note: string) {
    super('PROVIDER_UNSUPPORTED', `[${provider}] ${note}`, 501, { provider });
  }
}

export class ProviderUnconfiguredError extends EngineError {
  constructor(provider: string, missing: readonly string[]) {
    super(
      'PROVIDER_UNCONFIGURED',
      `[${provider}] missing environment: ${missing.join(', ')}`,
      503,
      { provider, missing },
    );
  }
}

export class RateLimitError extends EngineError {
  constructor(scope: string, retryAfterMs: number) {
    super('RATE_LIMITED', `Rate limit exceeded for ${scope}`, 429, { scope, retryAfterMs });
  }
}

export class ValidationError extends EngineError {
  constructor(message: string, issues: unknown[] = []) {
    super('VALIDATION_ERROR', message, 400, { issues });
  }
}

export class NotFoundError extends EngineError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`, 404, { resource, id });
  }
}

export class UnauthorizedError extends EngineError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export function isTransient(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof EngineError) return error.status >= 500 || error.status === 429;
  if (error instanceof Error) {
    return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|aborted/i.test(error.message);
  }
  return false;
}

export function toEngineError(error: unknown): EngineError {
  if (error instanceof EngineError) return error;
  if (error instanceof Error) return new EngineError('INTERNAL_ERROR', error.message);
  return new EngineError('INTERNAL_ERROR', String(error));
}
