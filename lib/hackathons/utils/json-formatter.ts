/**
 * json-formatter.ts
 * Thin, explicit JSON export helpers, kept consistent across the module.
 */

export function toPrettyJson<T>(data: T): string {
  return JSON.stringify(data, null, 2);
}

export function toCompactJson<T>(data: T): string {
  return JSON.stringify(data);
}

export function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
