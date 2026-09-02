/**
 * lib/flashcards/http/errors.ts
 *
 * Route-layer error types, separate from lib/ai/utils/errors.ts's
 * AIValidationError (which the flashcards services already throw for
 * validation/not-found cases). response.ts maps both to the right status.
 */

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in.") {
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

export class ForbiddenError extends Error {
  constructor(message = "You don't have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
