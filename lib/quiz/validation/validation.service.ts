/**
 * lib/quiz/validation/validation.service.ts
 *
 * Single entry point API routes use to validate incoming requests — wraps
 * zod's SafeParseReturnType into a consistent { ok, data | issues } shape
 * so route handlers don't each write their own try/catch around .parse().
 */

import type { z } from "zod";

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; issues: string[] };

export function validate<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
  };
}

export {
  generateQuizRequestSchema,
  generatedQuizSchema,
  submitResponseSchema,
  submitAttemptSchema,
  startAttemptSchema,
  exportQuizRequestSchema,
} from "./quiz-schemas";
export { questionSchema, schemaForType } from "./question-schemas";
