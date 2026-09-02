/**
 * lib/ai/prompts/_shared.ts
 *
 * Small shared pieces every prompt/<feature>.ts file uses, so bumping a
 * prompt's version or generation defaults doesn't mean touching every file.
 */

export interface GenerationParams {
  temperature: number;
  maxOutputTokens: number;
}

export interface PromptDefinition<TInput, TOutput> {
  /** Bump this string whenever the system prompt or schema changes meaningfully. */
  version: string;
  feature: string;
  systemPrompt: string;
  buildUserPrompt: (input: TInput) => string;
  responseSchema: Record<string, unknown>;
  generation: GenerationParams;
  __outputType?: TOutput; // type-only marker, never populated at runtime
}

/** Common closing instruction appended to every system prompt to enforce schema-only output. */
export const JSON_ONLY_SUFFIX =
  "Respond with a single JSON object matching the provided schema exactly. " +
  "No prose before or after the JSON. No markdown code fences.";
