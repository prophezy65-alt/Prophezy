// lib/assignment/prompts/quality-check.ts
import { PromptDefinition, withJsonSuffix, isPlainObject, isStringArray } from "./_shared";

export interface QualityCheckResponse {
  grammarIssues: {
    originalText: string;
    suggestion: string;
    ruleType: "grammar" | "spelling" | "punctuation" | "style";
  }[];
  detectedTone: "casual" | "academic" | "professional" | "mixed";
  toneSuggestions: string[];
  consistencyNotes: string[];
}

const SCHEMA = `{
  "grammarIssues": [{ "originalText": string, "suggestion": string, "ruleType": "grammar"|"spelling"|"punctuation"|"style" }],
  "detectedTone": "casual"|"academic"|"professional"|"mixed",
  "toneSuggestions": string[],
  "consistencyNotes": string[]
}`;

const SYSTEM_PROMPT = withJsonSuffix(
  `You are an academic writing quality reviewer. Given a student's written text
(an answer, essay, or report section), identify:

1. grammarIssues: concrete grammar, spelling, punctuation, or style problems. For each,
   quote the EXACT original phrase (short — a clause or sentence, not the whole
   document) and a corrected suggestion. Only report real issues; do not invent issues
   in already-correct text. Cap at 20 most significant issues.
2. detectedTone: the dominant tone of the writing.
3. toneSuggestions: 1-4 concrete suggestions to make the tone more consistent with
   academic/professional writing, ONLY if detectedTone is "casual" or "mixed". Return an
   empty array if the tone is already appropriate.
4. consistencyNotes: notable internal inconsistencies (contradicting statements,
   inconsistent terminology/notation, inconsistent verb tense across sections). Empty
   array if none found.

Do not rewrite the entire text. Do not comment on factual correctness — that is handled
elsewhere. Focus purely on writing mechanics and internal consistency.`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const text = typeof input.text === "string" ? input.text : "";
  return `Text to review:\n\n${text}`;
}

function validate(parsed: unknown): parsed is QualityCheckResponse {
  if (!isPlainObject(parsed)) return false;
  if (!Array.isArray(parsed.grammarIssues)) return false;
  if (!["casual", "academic", "professional", "mixed"].includes(parsed.detectedTone as string)) return false;
  if (!isStringArray(parsed.toneSuggestions)) return false;
  if (!isStringArray(parsed.consistencyNotes)) return false;
  return true;
}

export const qualityCheckPrompt: PromptDefinition<QualityCheckResponse> = {
  id: "assignment.quality.check",
  feature: "assignment_quality",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.1,
  maxOutputTokens: 4096,
  validate,
};
