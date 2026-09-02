/**
 * lib/project-generator/services/parsing.ts
 *
 * Shared runtime type assertions used to safely narrow the AI Core's raw
 * JSON responses into typed shapes, without a schema-validation library
 * (matching the rest of the codebase's dependency-free `validator.ts`
 * approach — see the existing AI Core README).
 */

export function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Expected non-empty string at "${field}", got ${JSON.stringify(value)}.`);
  }
  return value;
}

export function assertOptionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  return assertString(value, field);
}

export function assertNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected finite number at "${field}", got ${JSON.stringify(value)}.`);
  }
  return value;
}

export function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean at "${field}", got ${JSON.stringify(value)}.`);
  }
  return value;
}

export function assertArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at "${field}", got ${JSON.stringify(value)}.`);
  }
  return value;
}

export function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected object at "${field}", got ${JSON.stringify(value)}.`);
  }
  return value as Record<string, unknown>;
}

export function assertOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const str = assertString(value, field);
  if (!(allowed as readonly string[]).includes(str)) {
    throw new Error(`Expected "${field}" to be one of [${allowed.join(", ")}], got "${str}".`);
  }
  return str as T;
}

/** Case/format-tolerant enum coercion with a safe fallback (used when the AI drifts from the exact literal). */
export function coerceEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const match = allowed.find((a) => a.toLowerCase() === normalized);
  return match ?? fallback;
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Coerces a possibly-missing boolean field to a sensible default instead of
 * throwing. LLM JSON output sometimes omits boolean fields entirely
 * (especially `false` values, which some models treat as "the default,
 * no need to include it") — for optional structural flags like
 * `nullable`/`isPrimaryKey`/`isUnique`, failing the whole generation over
 * one missing flag is worse than defaulting it. Use `assertBoolean` instead
 * when the field is truly required and a wrong default would be misleading.
 */
export function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Coerces a possibly-missing/empty narrative string field to a fallback
 * instead of throwing. Same rationale as coerceBoolean: LLMs sometimes
 * omit optional-feeling text fields (like `description`) on individual
 * array items, especially deep in large nested JSON. Failing the whole
 * generation over one missing description is worse than substituting a
 * clearly-marked placeholder the user can edit later. Never use this for
 * fields whose actual VALUE drives logic (names, ids, types) — only for
 * fields that are purely explanatory.
 */
export function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
