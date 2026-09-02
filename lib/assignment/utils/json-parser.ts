// lib/assignment/utils/json-parser.ts
// Safe JSON parsing/serialization for assignment domain objects (e.g. cached
// extraction results stored in Redis, or JSON exports). This is distinct
// from lib/ai/utils/json.ts in the AI Core Engine, which repairs raw model
// text — that stays the single source of truth for parsing AI output.

export interface SafeParseResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export function safeJsonParse<T>(raw: string): SafeParseResult<T> {
  try {
    const data = JSON.parse(raw) as T;
    return { success: true, data, error: null };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : "Unknown JSON parse error",
    };
  }
}

export function safeJsonStringify(value: unknown, pretty = false): SafeParseResult<string> {
  try {
    const data = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
    return { success: true, data, error: null };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : "Unknown JSON stringify error",
    };
  }
}

/** Deep-clones via JSON round-trip. Only safe for plain data (no functions,
 * Dates, Buffers, or circular refs) — sufficient for the domain types in
 * models/types.ts, which are all plain data. */
export function jsonDeepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
