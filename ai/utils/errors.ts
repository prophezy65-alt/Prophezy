/**
 * lib/ai/utils/errors.ts
 *
 * Shared error types for the AI engine. Kept separate from config/client.ts
 * so utils/retry.ts (which client.ts also depends on) doesn't create a
 * circular import.
 */

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
  }
}

export class AIRequestError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "AIRequestError";
    this.status = status;
    this.body = body;
  }
}

export class AITimeoutError extends Error {
  constructor(message = "Gemini request timed out") {
    super(message);
    this.name = "AITimeoutError";
  }
}

export class AISafetyBlockedError extends Error {
  reason?: string;
  constructor(message: string, reason?: string) {
    super(message);
    this.name = "AISafetyBlockedError";
    this.reason = reason;
  }
}

export class AIValidationError extends Error {
  issues?: unknown;
  constructor(message: string, issues?: unknown) {
    super(message);
    this.name = "AIValidationError";
    this.issues = issues;
  }
}
