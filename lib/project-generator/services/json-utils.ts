/**
 * lib/project-generator/services/json-utils.ts
 *
 * Defensive JSON parsing for AI Core responses. Even in JSON mode, models
 * occasionally wrap output in Markdown code fences, add a preamble
 * sentence, or leave a trailing comma. This module repairs the common
 * cases before parsing and throws a descriptive error when it truly
 * cannot be salvaged, so the caller can trigger a corrective retry.
 */

const CODE_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

/** Strips a leading/trailing Markdown code fence, if present. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(CODE_FENCE_PATTERN);
  return match ? match[1]!.trim() : trimmed;
}

/** Removes a non-JSON preamble/postamble by slicing to the outermost { } or [ ] pair. */
function sliceToOutermostJson(text: string): string {
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const candidates = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (candidates.length === 0) return text;

  const start = Math.min(...candidates);
  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";

  let depth = 0;
  let end = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  return end >= 0 ? text.slice(start, end + 1) : text.slice(start);
}

/** Removes trailing commas before `}` or `]`, which JSON.parse rejects but models sometimes emit. */
function stripTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

export class JsonRepairError extends Error {
  constructor(message: string, public readonly rawText: string, public override readonly cause?: unknown) {
    super(message);
    this.name = "JsonRepairError";
  }
}

/**
 * Attempts to parse `rawText` as JSON, applying repairs (code-fence
 * stripping, preamble slicing, trailing-comma removal) in order of
 * increasing invasiveness until parsing succeeds.
 */
export function parseJsonWithRepair(rawText: string): unknown {
  const attempts: readonly (() => string)[] = [
    () => rawText,
    () => stripCodeFence(rawText),
    () => stripTrailingCommas(stripCodeFence(rawText)),
    () => sliceToOutermostJson(stripCodeFence(rawText)),
    () => stripTrailingCommas(sliceToOutermostJson(stripCodeFence(rawText))),
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    const candidate = attempt();
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw new JsonRepairError("Unable to parse AI Core response as JSON after all repair attempts.", rawText, lastError);
}
