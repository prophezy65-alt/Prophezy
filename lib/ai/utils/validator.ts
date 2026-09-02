/**
 * lib/ai/utils/validator.ts
 *
 * Lightweight response validation. If the project already has `zod` as a
 * dependency, prefer passing a zod schema's `.parse` via `withZod` below;
 * otherwise use `validateShape` for a dependency-free structural check.
 */

import { AIValidationError } from "./errors";

export type FieldRule =
  | { type: "string"; required?: boolean; minLength?: number; maxLength?: number }
  | { type: "number"; required?: boolean; min?: number; max?: number }
  | { type: "boolean"; required?: boolean }
  | { type: "array"; required?: boolean; minItems?: number }
  | { type: "object"; required?: boolean };

export type Shape = Record<string, FieldRule>;

export function validateShape(data: unknown, shape: Shape): { ok: true; data: any } {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new AIValidationError("Expected a JSON object at the top level.", { data });
  }

  const obj = data as Record<string, unknown>;
  const issues: string[] = [];

  for (const [key, rule] of Object.entries(shape)) {
    const value = obj[key];
    const present = value !== undefined && value !== null;

    if (!present) {
      if (rule.required) issues.push(`Missing required field "${key}"`);
      continue;
    }

    switch (rule.type) {
      case "string":
        if (typeof value !== "string") issues.push(`"${key}" must be a string`);
        else {
          if (rule.minLength && value.length < rule.minLength)
            issues.push(`"${key}" shorter than minLength ${rule.minLength}`);
          if (rule.maxLength && value.length > rule.maxLength)
            issues.push(`"${key}" longer than maxLength ${rule.maxLength}`);
        }
        break;
      case "number":
        if (typeof value !== "number") issues.push(`"${key}" must be a number`);
        else {
          if (rule.min !== undefined && value < rule.min)
            issues.push(`"${key}" below min ${rule.min}`);
          if (rule.max !== undefined && value > rule.max)
            issues.push(`"${key}" above max ${rule.max}`);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") issues.push(`"${key}" must be a boolean`);
        break;
      case "array":
        if (!Array.isArray(value)) issues.push(`"${key}" must be an array`);
        else if (rule.minItems && value.length < rule.minItems)
          issues.push(`"${key}" needs at least ${rule.minItems} items`);
        break;
      case "object":
        if (typeof value !== "object" || Array.isArray(value))
          issues.push(`"${key}" must be an object`);
        break;
    }
  }

  if (issues.length > 0) {
    throw new AIValidationError("Response failed shape validation.", issues);
  }

  return { ok: true, data: obj };
}

/**
 * Adapter for projects that add zod later:
 *   withZod(mySchema, parsedJson)
 * Kept generic (no zod import) so this file has zero required dependencies.
 */
export function withZod<T>(schema: { parse: (input: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    throw new AIValidationError("Response failed zod schema validation.", err);
  }
}
