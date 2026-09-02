/**
 * lib/syllabus/utils/syllabus.errors.ts
 *
 * Scoped to functionality that is NEW in this module (file
 * ingestion/parsing, deterministic planning math) and therefore has
 * no existing error class to reuse. Anything that goes through the
 * shared AI engine (extraction, roadmap, notes, quiz, etc.) throws
 * the EXISTING `AIRequestError` / `AIValidationError` /
 * `AITimeoutError` from `@/lib/ai/utils/errors` instead — see
 * services/_syllabus-ai.runner.ts.
 */

export class SyllabusError extends Error {
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

/** A file-parsing/OCR step (PDF, DOCX, image) failed. */
export class ProviderRequestError extends SyllabusError {
  constructor(
    public readonly step: string,
    message: string,
    cause?: unknown,
  ) {
    super(`[${step}] ${message}`, 'SYLLABUS_INGESTION_ERROR', cause);
  }
}

/** A referenced syllabus record could not be found (bad syllabusId). */
export class SyllabusNotFoundError extends SyllabusError {
  constructor(public readonly syllabusId: string) {
    super(`Syllabus not found: ${syllabusId}`, 'SYLLABUS_NOT_FOUND');
  }
}

export function isSyllabusError(err: unknown): err is SyllabusError {
  return err instanceof SyllabusError;
}
