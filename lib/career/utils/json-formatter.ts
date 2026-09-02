/**
 * json-formatter.ts
 * Thin, explicit JSON export helpers. Kept as real functions (not just
 * `JSON.stringify` inline everywhere) so export.service.ts has one
 * consistent, testable place per output shape, and so pretty-printing
 * conventions (2-space indent) stay uniform across the module.
 */

export function toPrettyJson<T>(data: T): string {
  return JSON.stringify(data, null, 2);
}

export function toCompactJson<T>(data: T): string {
  return JSON.stringify(data);
}

/**
 * Safely parses JSON text, returning null instead of throwing — used when
 * reading back cached AI Core JSON responses that might be malformed.
 */
export function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
