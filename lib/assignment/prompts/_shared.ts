// lib/assignment/prompts/_shared.ts
// Mirrors the PromptDefinition contract used by lib/ai/prompts/_shared.ts in the
// existing AI Core Engine. Every assignment prompt below is built with this
// helper so it flows through the SAME runAI()/runAIStream() pipeline —
// rate limiting, caching, retries, safety checks, and logging are inherited
// for free. We never call Gemini directly from this module.

export interface PromptDefinition<TResponse> {
  id: string;
  /** The Core Engine "feature" bucket this prompt routes through — drives
   * model selection (config/models.ts) and rate limiting (middleware/rate-limit.ts's
   * RATE_LIMIT_RULES) in lib/ai/engine.ts. This is NOT a per-call tier hint
   * (the real engine has no such concept — see providers/ai-engine.provider.ts) —
   * it's a fixed bucket name that must exist in the Core Engine's config.
   * New buckets introduced by this module (see README's "Core Engine
   * registration required" section) need to be added there before these
   * prompts will resolve to a model. */
  feature: string;
  systemPrompt: string;
  buildUserPrompt: (input: Record<string, unknown>) => string;
  jsonMode: true;
  responseSchemaDescription: string; // human-readable schema, embedded in system prompt for the model
  temperature: number;
  maxOutputTokens: number;
  // Runtime shape guard — cheap, dependency-free validation before the typed
  // result is handed back to the calling service. Throws locally (see
  // providers/ai-engine.provider.ts's AssignmentAiError) on shape mismatch.
  validate: (parsed: unknown) => parsed is TResponse;
}

const JSON_ONLY_SUFFIX = `
Respond with ONLY valid JSON matching the schema described above.
Do not include markdown code fences, explanations, or any text outside the JSON object.
Do not include trailing commas. Do not include comments.
If a field is unknown, use null (for optional fields) or an empty array/string as appropriate — never omit a required key.
`.trim();

export function withJsonSuffix(systemPrompt: string, schemaDescription: string): string {
  return `${systemPrompt}\n\nRESPONSE SCHEMA:\n${schemaDescription}\n\n${JSON_ONLY_SUFFIX}`;
}

/** Generic object-shape check used by every prompt's `validate()`. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}
