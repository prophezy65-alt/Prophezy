/**
 * lib/project-generator/models/shared.model.ts
 *
 * Cross-cutting primitives reused by every other model file in this module.
 * No business logic lives here — only shapes, guards and tiny pure helpers
 * that other models/services rely on for consistency.
 */

/** ISO-8601 timestamp string, e.g. 2026-07-23T10:15:00.000Z */
export type ISODateString = string;

/** UUID v4 string identifier. */
export type UUID = string;

/**
 * Generic wrapper for any value that can either succeed with data
 * or fail with a structured error. Used throughout services instead
 * of throwing raw exceptions across module boundaries.
 */
export type Result<T, E = GenerationError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}

/** Structured error shape returned by services/validators in this module. */
export interface GenerationError {
  readonly code: GenerationErrorCode;
  readonly message: string;
  readonly field?: string;
  readonly cause?: unknown;
  readonly retryable: boolean;
}

export type GenerationErrorCode =
  | "INVALID_SOURCE"
  | "SOURCE_TOO_LARGE"
  | "UNSUPPORTED_SOURCE_TYPE"
  | "AI_CORE_ERROR"
  | "AI_SAFETY_BLOCKED"
  | "AI_TIMEOUT"
  | "VALIDATION_FAILED"
  | "SCHEMA_MISMATCH"
  | "EXPORT_FAILED"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

/** Pagination cursor shared by list-style service methods. */
export interface PageRequest {
  readonly limit: number;
  readonly cursor?: string;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total: number;
}

/** Range helper used by estimation/roadmap models (hours, cost, complexity). */
export interface NumericRange {
  readonly min: number;
  readonly max: number;
}

export function isValidNumericRange(range: NumericRange): boolean {
  return (
    Number.isFinite(range.min) &&
    Number.isFinite(range.max) &&
    range.min >= 0 &&
    range.max >= range.min
  );
}

/** A single labelled score out of 100, used for difficulty/complexity/confidence. */
export interface ScoreValue {
  readonly score: number; // 0-100
  readonly label: string;
  readonly rationale: string;
}

export function isValidScoreValue(score: ScoreValue): boolean {
  return Number.isFinite(score.score) && score.score >= 0 && score.score <= 100 && score.label.length > 0;
}

/** Audit metadata attached to every generated artifact. */
export interface GenerationMetadata {
  readonly generationId: UUID;
  readonly userId: UUID;
  readonly createdAt: ISODateString;
  readonly aiModelUsed: string;
  readonly promptVersion: string;
  readonly durationMs: number;
}

/** Key/value tag pair used for categorizing generated projects. */
export interface Tag {
  readonly key: string;
  readonly value: string;
}

/** Generic named entity base that most domain models extend. */
export interface NamedEntity {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isUUID(value: unknown): value is UUID {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isISODateString(value: unknown): value is ISODateString {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}
