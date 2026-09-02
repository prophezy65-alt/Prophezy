// lib/humanizer/prompts/_shared.ts
// Same PromptDefinition contract as lib/assignment/prompts/_shared.ts —
// duplicated locally rather than imported cross-module so lib/humanizer/ has
// zero compile-time dependency on lib/assignment/ internals beyond the
// explicitly-reused parser/validation utilities noted in the README.

export interface PromptDefinition<TResponse> {
  id: string;
  systemPrompt: string;
  buildUserPrompt: (input: Record<string, unknown>) => string;
  jsonMode: true;
  responseSchemaDescription: string;
  temperature: number;
  maxTokens: number;
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

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
