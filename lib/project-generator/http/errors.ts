/**
 * lib/project-generator/http/errors.ts
 * Mirrors lib/flashcards/http/errors.ts's pattern for consistency.
 */

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationHttpError extends Error {
  constructor(message: string, public readonly issues?: unknown) {
    super(message);
    this.name = "ValidationHttpError";
  }
}
