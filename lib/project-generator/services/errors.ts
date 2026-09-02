/**
 * lib/project-generator/services/errors.ts
 *
 * Every service returns `Result<T, GenerationError>` rather than throwing
 * across module boundaries (see `models/shared.model.ts`). This file is the
 * single place that maps AI Core exceptions and internal failures onto the
 * shared `GenerationError` shape, so every service reports errors
 * consistently.
 */

import { GenerationError, GenerationErrorCode } from "../models";
import { JsonRepairError } from "./json-utils";

function makeError(code: GenerationErrorCode, message: string, retryable: boolean, cause?: unknown, field?: string): GenerationError {
  return { code, message, retryable, cause, field };
}

/**
 * Maps an unknown thrown value (AI Core error, validation error, or
 * anything else) into a `GenerationError`. Recognizes the AI Core's
 * documented error classes by `.name` so this module does not need a
 * hard import dependency on `lib/ai/utils/errors.ts`'s exact export path.
 */
export function toGenerationError(error: unknown, context: { readonly step: string }): GenerationError {
  if (error instanceof JsonRepairError) {
    return makeError(
      "SCHEMA_MISMATCH",
      `${context.step}: AI Core response was not valid JSON after repair attempts — ${error.message}`,
      true,
      error
    );
  }

  if (error instanceof Error) {
    switch (error.name) {
      case "AITimeoutError":
        return makeError("AI_TIMEOUT", `${context.step}: AI Core request timed out — ${error.message}`, true, error);
      case "AISafetyBlockedError":
        return makeError("AI_SAFETY_BLOCKED", `${context.step}: AI Core blocked the request — ${error.message}`, false, error);
      case "AIValidationError":
        return makeError("VALIDATION_FAILED", `${context.step}: ${error.message}`, false, error);
      case "AIRequestError":
        return makeError("AI_CORE_ERROR", `${context.step}: AI Core request failed — ${error.message}`, true, error);
      default:
        return makeError("INTERNAL_ERROR", `${context.step}: ${error.message}`, false, error);
    }
  }

  return makeError("INTERNAL_ERROR", `${context.step}: an unknown error occurred.`, false, error);
}

export function validationFailedError(step: string, problems: readonly string[]): GenerationError {
  return makeError(
    "VALIDATION_FAILED",
    `${step}: generated artifact failed validation — ${problems.join("; ")}`,
    true,
    problems,
    problems[0]
  );
}

export function notFoundError(step: string, message: string): GenerationError {
  return makeError("NOT_FOUND", `${step}: ${message}`, false);
}

export function invalidSourceError(step: string, problems: readonly string[]): GenerationError {
  return makeError("INVALID_SOURCE", `${step}: ${problems.join("; ")}`, false, problems, problems[0]);
}
