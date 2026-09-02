/**
 * lib/ai/utils/json.ts
 *
 * Gemini (like every LLM) occasionally wraps JSON in markdown fences, adds a
 * trailing comma, or emits a stray preamble sentence before the object. This
 * module extracts and repairs JSON from raw model output before it hits
 * app code, so services never have to defend against malformed JSON
 * themselves.
 */

import { AIValidationError } from "./errors";

/** Strips ```json ... ``` or ``` ... ``` fences if present. */
function stripCodeFences(input: string): string {
  const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1]!.trim() : input.trim();
}

/** Extracts the first balanced {...} or [...] block from a string. */
function extractFirstJsonBlock(input: string): string | null {
  const startChars = ["{", "["];
  const closeFor: Record<string, string> = { "{": "}", "[": "]" };

  for (const start of startChars) {
    const startIdx = input.indexOf(start);
    if (startIdx === -1) continue;

    const close = closeFor[start];
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIdx; i < input.length; i++) {
      const ch = input[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (ch === "\\") {
        escapeNext = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === start) depth++;
      if (ch === close) {
        depth--;
        if (depth === 0) {
          return input.slice(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

/** Removes trailing commas before ] or } which JSON.parse rejects. */
function removeTrailingCommas(input: string): string {
  return input.replace(/,(\s*[}\]])/g, "$1");
}

export interface SafeJsonParseResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
  raw: string;
}

/**
 * Attempts to parse LLM output as JSON, progressively repairing common
 * formatting issues. Never throws — check `.ok` before using `.data`.
 */
export function safeJsonParse<T = unknown>(raw: string): SafeJsonParseResult<T> {
  const attempts = [
    raw,
    stripCodeFences(raw),
    removeTrailingCommas(stripCodeFences(raw)),
  ];

  const block = extractFirstJsonBlock(stripCodeFences(raw));
  if (block) {
    attempts.push(block, removeTrailingCommas(block));
  }

  for (const attempt of attempts) {
    try {
      return { ok: true, data: JSON.parse(attempt) as T, raw };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    data: null,
    error: "Could not parse a valid JSON object from model output.",
    raw,
  };
}

/** Same as safeJsonParse but throws AIValidationError on failure. */
export function parseJsonOrThrow<T = unknown>(raw: string): T {
  const result = safeJsonParse<T>(raw);
  if (!result.ok || result.data === null) {
    throw new AIValidationError(result.error ?? "Invalid JSON from model", { raw });
  }
  return result.data;
}
