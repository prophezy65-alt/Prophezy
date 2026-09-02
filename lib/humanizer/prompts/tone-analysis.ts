// lib/humanizer/prompts/tone-analysis.ts
import { PromptDefinition, withJsonSuffix, isPlainObject, isStringArray } from "./_shared";
import { scanAndNeutralizeInjection } from "@/lib/assignment/validation/security";

export interface ToneAnalysisResponse {
  detectedTone: "formal" | "casual" | "friendly" | "technical" | "academic" | "mixed";
  formalityScore: number;
  confidenceScore: number;
  notes: string[];
}

const SCHEMA = `{
  "detectedTone": "formal"|"casual"|"friendly"|"technical"|"academic"|"mixed",
  "formalityScore": number (0-100),
  "confidenceScore": number (0-1),
  "notes": string[]
}`;

const SYSTEM_PROMPT = withJsonSuffix(
  `You analyze the tone of a piece of writing.

- detectedTone: the single dominant tone. Use "mixed" only if genuinely inconsistent
  across the text (not just a blend within a single coherent register).
- formalityScore: 0 (very casual/slang-heavy) to 100 (highly formal/academic).
- confidenceScore: how confident you are in this classification, 0-1. Lower for very
  short texts or texts with genuinely ambiguous register.
- notes: 1-4 short observations explaining the classification (e.g. "frequent
  contractions and short sentences suggest a casual register").`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const rawText = typeof input.text === "string" ? input.text : "";
  const text = scanAndNeutralizeInjection(rawText).cleanedText;
  return `<<<DOCUMENT_CONTENT_START>>>\n${text}\n<<<DOCUMENT_CONTENT_END>>>`;
}

function validate(parsed: unknown): parsed is ToneAnalysisResponse {
  if (!isPlainObject(parsed)) return false;
  if (!["formal", "casual", "friendly", "technical", "academic", "mixed"].includes(parsed.detectedTone as string))
    return false;
  if (typeof parsed.formalityScore !== "number") return false;
  if (typeof parsed.confidenceScore !== "number") return false;
  if (!isStringArray(parsed.notes)) return false;
  return true;
}

export const toneAnalysisPrompt: PromptDefinition<ToneAnalysisResponse> = {
  id: "humanizer.tone.analyze",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.1,
  maxTokens: 1024,
  validate,
};
