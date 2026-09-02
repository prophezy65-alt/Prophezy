/**
 * lib/document/utils/json-builder.ts
 * Safe JSON stringify/parse helpers with circular-reference protection.
 */

export function safeStringify(value: unknown, space = 2): string {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    },
    space
  );
}

export function safeParse<T>(text: string): { ok: true; data: T } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
