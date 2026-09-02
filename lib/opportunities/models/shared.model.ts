/**
 * lib/opportunities/models/shared.model.ts
 *
 * Cross-cutting primitives reused by every other model file in this
 * module — mirrors the same `Result<T,E>` pattern used by the Project
 * Generator (`lib/project-generator/models/shared.model.ts`) so error
 * handling is consistent across Prophezy's backend modules.
 */

export type ISODateString = string;
export type UUID = string;

export type Result<T, E = OpportunityEngineError> =
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

export type OpportunityEngineErrorCode =
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_FETCH_FAILED"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "NORMALIZATION_FAILED"
  | "VALIDATION_FAILED"
  | "DEDUP_FAILED"
  | "SYNC_ALREADY_RUNNING"
  | "CACHE_ERROR"
  | "SEARCH_INDEX_ERROR"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "INTERNAL_ERROR";

export interface OpportunityEngineError {
  readonly code: OpportunityEngineErrorCode;
  readonly message: string;
  readonly providerId?: string;
  readonly cause?: unknown;
  readonly retryable: boolean;
}

export interface PageRequest {
  readonly limit: number;
  readonly cursor?: string;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total: number;
}

export interface DateRange {
  readonly from: ISODateString | null;
  readonly to: ISODateString | null;
}

export function isValidDateRange(range: DateRange): boolean {
  if (range.from && Number.isNaN(Date.parse(range.from))) return false;
  if (range.to && Number.isNaN(Date.parse(range.to))) return false;
  if (range.from && range.to) return Date.parse(range.from) <= Date.parse(range.to);
  return true;
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
  return !Number.isNaN(Date.parse(value));
}

/** SHA-256 hex digest, used throughout for dedup content hashes and cache keys. */
export type Sha256Hex = string;

export function isSha256Hex(value: unknown): value is Sha256Hex {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}
