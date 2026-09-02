// lib/assignment/prompts/formatter.ts
import { PromptDefinition, withJsonSuffix, isPlainObject } from "./_shared";

export type RewriteRegister = "academic" | "professional" | "simple" | "technical";

export interface FormatterResponse {
  rewrittenText: string;
  changesSummary: string;
}

const SCHEMA = `{
  "rewrittenText": string,
  "changesSummary": string
}`;

const REGISTER_GUIDANCE: Record<RewriteRegister, string> = {
  academic:
    "Formal academic register: precise terminology, passive voice where conventional, " +
    "no contractions, third person, well-structured paragraphs with topic sentences.",
  professional:
    "Clear professional/business register: direct, confident, active voice, minimal " +
    "jargon unless necessary, suitable for a workplace report or memo.",
  simple:
    "Plain-language register: short sentences, common words, explain any necessary " +
    "technical term the first time it's used. Suitable for someone new to the topic.",
  technical:
    "Rigorous technical register: precise terminology used correctly and consistently, " +
    "assumes subject-matter familiarity, includes necessary technical qualifiers/caveats.",
};

const SYSTEM_PROMPT = withJsonSuffix(
  `You rewrite student-provided text into a specified tone/register WITHOUT changing its
factual content or meaning. You are a style editor, not a content editor.

Rules:
- Preserve every fact, number, and claim in the original — do not add or remove
  substantive content.
- Preserve any code blocks, formulas, or citations verbatim.
- changesSummary: a brief (1-2 sentence) description of what kind of changes were made
  (e.g. "Converted contractions and casual phrasing to formal academic register;
  restructured two run-on sentences").`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const text = typeof input.text === "string" ? input.text : "";
  const register = (typeof input.register === "string" ? input.register : "academic") as RewriteRegister;
  const guidance = REGISTER_GUIDANCE[register] ?? REGISTER_GUIDANCE.academic;
  return `Target register: ${register}\nGuidance: ${guidance}\n\nText to rewrite:\n\n${text}`;
}

function validate(parsed: unknown): parsed is FormatterResponse {
  if (!isPlainObject(parsed)) return false;
  return typeof parsed.rewrittenText === "string" && typeof parsed.changesSummary === "string";
}

export const formatterPrompt: PromptDefinition<FormatterResponse> = {
  id: "assignment.formatter.rewrite",
  feature: "assignment_formatter",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.3,
  maxOutputTokens: 6144,
  validate,
};
