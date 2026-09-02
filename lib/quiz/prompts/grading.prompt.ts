/**
 * lib/quiz/prompts/grading.prompt.ts
 *
 * Grades a single ai_graded response (short_answer, long_answer, essay,
 * case_study, programming, debugging, sql, coding_challenge, and every
 * subject-tagged type). Called by grading.service.ts, one question at a
 * time, so partial-credit reasoning stays focused and cacheable per
 * (question, response) pair.
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";
import type { QuizQuestionType } from "../models/quiz.types";

export interface GradingInput {
  questionType: QuizQuestionType;
  questionText: string;
  modelSolution: string;
  rubric: string[];
  maxMarks: number;
  studentResponse: string;
}

export interface GradingOutput {
  marksAwarded: number;
  isCorrect: boolean; // true only if marksAwarded === maxMarks
  feedback: string;
  rubricBreakdown: Array<{ criterion: string; met: boolean; note: string }>;
}

const SYSTEM_PROMPT = `You are Prophezy's AI grader for open-ended quiz responses. You grade
strictly against the provided model solution and rubric — not against your own opinion of
what a good answer looks like.

Rules:
- Award partial credit proportionally: if 3 of 5 rubric criteria are clearly met, award
  marksAwarded close to (3/5) * maxMarks, not a round number chosen by feel.
- For programming/sql/debugging/coding_challenge: judge correctness primarily by whether the
  logic would pass the described test cases, not by code style, unless the rubric explicitly
  penalizes style.
- Be lenient on phrasing and terminology as long as the underlying concept is correct; be
  strict on factual or logical errors.
- isCorrect is true only when marksAwarded equals maxMarks exactly — partial credit is never
  "correct".
- feedback must be specific to what THIS response got right or wrong — never generic
  boilerplate like "good effort".

${JSON_ONLY_SUFFIX}`;

function buildUserPrompt(input: GradingInput): string {
  return [
    `Question type: ${input.questionType}`,
    `Question: ${input.questionText}`,
    `Max marks: ${input.maxMarks}`,
    `Model solution: ${input.modelSolution}`,
    `Rubric: ${input.rubric.length ? input.rubric.join(" | ") : "(none provided — grade holistically against the model solution)"}`,
    ``,
    `Student response:`,
    input.studentResponse || "(no response submitted)",
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    marksAwarded: { type: "number" },
    isCorrect: { type: "boolean" },
    feedback: { type: "string" },
    rubricBreakdown: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string" },
          met: { type: "boolean" },
          note: { type: "string" },
        },
        required: ["criterion", "met", "note"],
      },
    },
  },
  required: ["marksAwarded", "isCorrect", "feedback", "rubricBreakdown"],
} as const;

export const GRADING_PROMPT: PromptDefinition<GradingInput, GradingOutput> = {
  version: "1.0.0",
  feature: "quiz.grade",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  responseSchema: RESPONSE_SCHEMA,
  generation: {
    temperature: 0.2,
    maxOutputTokens: 1024,
  },
};
