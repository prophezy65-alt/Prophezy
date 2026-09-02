/**
 * lib/quiz/prompts/quiz-generation.prompt.ts
 *
 * PromptDefinition for generating a full quiz from source content. Consumed
 * by generator.service.ts via runStructured() — never call runAI directly.
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";
import type { QuizDifficulty, QuizExamMode, QuizQuestionType } from "../models/quiz.types";

export interface QuizGenerationInput {
  sourceContent: string; // resolved text: uploaded doc chunks, notes, syllabus, or raw topic/URL text
  title?: string;
  examMode: QuizExamMode;
  difficulty: QuizDifficulty;
  isAdaptive: boolean;
  questionTypes: QuizQuestionType[];
  questionCount: number;
  // Set on backfill rounds only (see generator.service.ts) — question texts
  // already accepted from an earlier round on the same source content, so
  // the model tops up the count with genuinely new questions instead of
  // rephrasing ones we already have.
  avoidQuestionTexts?: string[];
}

export interface QuizGenerationOutput {
  title: string;
  questions: Array<Record<string, unknown>>; // validated against question-schemas.ts#questionSchema after return
}

const SYSTEM_PROMPT = `You are Prophezy's Quiz Intelligence Engine — an expert assessment
designer across academic and professional domains (STEM, medicine, law, business, AI/ML,
programming). Given source material and generation parameters, you produce a complete,
pedagogically sound quiz.

Rules:
- Every question must be directly answerable from the given source content — never invent
  facts not supported by it, except for well-established domain knowledge needed to phrase
  distractors (e.g. plausible wrong MCQ options).
- Match the requested difficulty consistently: "easy" = direct recall, "medium" = applied
  understanding, "hard" = multi-step reasoning or synthesis, "expert" = edge cases, proofs,
  or professional-level judgment calls.
- Only use the question types provided in the request. Distribute questions roughly evenly
  across the requested types unless the source content strongly favors one type.
- For code-related types (programming, debugging, sql, coding_challenge), test cases must be
  concrete and runnable, not placeholders.
- For essay/case_study/subject-response types, the model solution must be a genuine, complete
  answer a top student would write — not a bullet-point outline.
- Every question needs a non-empty hint that nudges without giving away the answer, and an
  explanation that would teach a student who got it wrong.
- Never include a question whose correct answer is ambiguous or debatable.
- Tag every question with 1-3 concept_tags describing the specific sub-topic it tests, for
  downstream weak/strong-topic analytics.

MANDATORY FIELDS BY QUESTION TYPE — every field listed for a type is REQUIRED and must never
be omitted, left null, or left empty. A question missing any of these fields is invalid and
will be discarded, so re-check every object against this table before finalizing your answer:
  - mcq: "options" (2-8 objects, each {"key": "A"/"B"/"C"/"D", "text": "..."}) AND
    "correctOption" (must exactly equal one option's "key", e.g. "B").
  - true_false: "correctOption" (exactly the string "true" or "false").
  - fill_in_blank, one_word: "correctOption" (the accepted answer text).
  - multiple_select: "options" (3-10 objects like mcq) AND "correctOptions" (array of 2+ keys
    from those options).
  - match_following: "pairs" (3-10 objects, each {"left": "...", "right": "..."}).
  - ordering: "items" (3-10 strings) AND "correctOrder" (array of the correct zero-based index
    order).
  - short_answer, long_answer, essay, mathematics, physics, chemistry, biology, engineering,
    medical, law, business, ai_ml: "modelSolution" (a real, complete answer) and "rubric".
  - case_study: all of the above plus "scenario".
  - programming, debugging, sql, coding_challenge: "language", "testCases" (1+ concrete cases),
    plus "buggyCode" for debugging / "schemaContext" for sql / "constraints" for coding_challenge.
  Every question type also always needs: "questionText", "difficulty", "marks", "hint",
  "explanation", "conceptTags".

You must return EXACTLY the number of questions requested — not fewer, not more. If you are
unsure you can produce that many high-quality questions, still produce exactly that many;
prioritize meeting the count and the mandatory-field list above over adding extra polish.

${JSON_ONLY_SUFFIX}`;

function buildUserPrompt(input: QuizGenerationInput): string {
  const lines = [
    input.title
      ? `Generate a quiz titled "${input.title}" from the following source content.`
      : `Generate a quiz from the following source content. Invent a concise, specific, descriptive title yourself (e.g. "Cell Biology: Membrane Transport" or "Data Structures: Binary Trees") based on what the content actually covers — never use a generic placeholder like "Untitled Quiz" or "Quiz 1".`,
    ``,
    `Exam mode: ${input.examMode}`,
    `Target difficulty: ${input.difficulty}`,
    `Adaptive difficulty run: ${input.isAdaptive ? "yes — vary individual question difficulty slightly around the target so later adaptive logic has room to move" : "no — keep every question at the target difficulty"}`,
    `Allowed question types: ${input.questionTypes.join(", ")}`,
    `Number of questions: EXACTLY ${input.questionCount} — return this many "questions" array entries, no fewer.`,
  ];

  if (input.avoidQuestionTexts && input.avoidQuestionTexts.length > 0) {
    lines.push(
      ``,
      `This is a top-up round: the questions below were already accepted from this same source content in an earlier round. Do not repeat them or produce close rephrasings — write ${input.questionCount} entirely new question(s) covering different facts, sections, or angles of the source content.`,
      `--- ALREADY-USED QUESTIONS (do not repeat) ---`,
      ...input.avoidQuestionTexts.map((q, i) => `${i + 1}. ${q}`),
      `--- END ALREADY-USED QUESTIONS ---`,
    );
  }

  lines.push(``, `--- SOURCE CONTENT START ---`, input.sourceContent, `--- SOURCE CONTENT END ---`);
  return lines.join("\n");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "A specific, descriptive quiz title based on its actual content — never a generic placeholder." },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionType: { type: "string" },
          questionText: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard", "expert"] },
          marks: { type: "number" },
          hint: { type: "string" },
          explanation: { type: "string" },
          stepSolution: { type: "string" },
          conceptTags: { type: "array", items: { type: "string" } },
          // type-specific fields — present/absent depending on questionType,
          // validated precisely against question-schemas.ts after return.
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { key: { type: "string" }, text: { type: "string" } },
            },
          },
          correctOption: { type: "string" },
          correctOptions: { type: "array", items: { type: "string" } },
          acceptableVariants: { type: "array", items: { type: "string" } },
          pairs: {
            type: "array",
            items: {
              type: "object",
              properties: { left: { type: "string" }, right: { type: "string" } },
            },
          },
          items: { type: "array", items: { type: "string" } },
          correctOrder: { type: "array", items: { type: "number" } },
          modelSolution: { type: "string" },
          rubric: { type: "array", items: { type: "string" } },
          scenario: { type: "string" },
          language: { type: "string" },
          starterCode: { type: "string" },
          buggyCode: { type: "string" },
          schemaContext: { type: "string" },
          constraints: { type: "array", items: { type: "string" } },
          testCases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                input: { type: "string" },
                expectedOutput: { type: "string" },
                hidden: { type: "boolean" },
              },
            },
          },
        },
        // correctOption is required at the schema level (not just in prose)
        // because Gemini's constrained JSON decoding follows this `required`
        // list more reliably than the system prompt's instructions — and
        // every type this feature currently generates (mcq, true_false)
        // genuinely needs it.
        required: ["questionType", "questionText", "difficulty", "marks", "correctOption", "explanation"],
      },
    },
  },
  required: ["title", "questions"],
} as const;

export const QUIZ_GENERATION_PROMPT: PromptDefinition<QuizGenerationInput, QuizGenerationOutput> = {
  version: "1.0.0",
  feature: "quiz.generate",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  responseSchema: RESPONSE_SCHEMA,
  generation: {
    temperature: 0.6,
    maxOutputTokens: 8192,
  },
};
