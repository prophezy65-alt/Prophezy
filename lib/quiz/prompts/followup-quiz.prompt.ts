/**
 * lib/quiz/prompts/followup-quiz.prompt.ts
 *
 * Generates a short, targeted follow-up quiz after a graded attempt —
 * weighted toward the user's weak topics and questions they got wrong.
 * Reuses the same output shape as quiz-generation.prompt.ts so
 * generator.service.ts can persist both through one code path.
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";
import type { QuizGenerationOutput } from "./quiz-generation.prompt";
import type { QuizDifficulty, QuizQuestionType } from "../models/quiz.types";

export interface FollowupQuizInput {
  sourceContent: string;
  weakTopics: string[]; // topic names, ordered worst-first
  missedQuestionTexts: string[]; // questions the user answered incorrectly last attempt
  difficulty: QuizDifficulty;
  questionTypes: QuizQuestionType[];
  questionCount: number;
}

const SYSTEM_PROMPT = `You are Prophezy's Quiz Intelligence Engine generating a targeted
follow-up quiz. The learner just finished an attempt and has identified weak topics and
specific missed questions. Your job is remediation, not a fresh assessment:

- Weight questions heavily toward the listed weak topics — most questions should come from
  there, not spread evenly across the whole source.
- Do not repeat the missed questions verbatim; write new questions that test the same
  underlying concept from a different angle, so the learner can't just memorize the old
  answer.
- Keep difficulty one notch below the requested target for the first third of questions to
  rebuild confidence, then ramp to the target for the rest.
- Every explanation should explicitly connect back to why the concept was likely missed.

${JSON_ONLY_SUFFIX}`;

function buildUserPrompt(input: FollowupQuizInput): string {
  return [
    `Weak topics (worst first): ${input.weakTopics.join(", ") || "none flagged — general revision"}`,
    `Previously missed questions (do not repeat verbatim):`,
    ...input.missedQuestionTexts.map((q, i) => `${i + 1}. ${q}`),
    ``,
    `Target difficulty: ${input.difficulty}`,
    `Allowed question types: ${input.questionTypes.join(", ")}`,
    `Number of questions: ${input.questionCount}`,
    ``,
    `--- SOURCE CONTENT START ---`,
    input.sourceContent,
    `--- SOURCE CONTENT END ---`,
  ].join("\n");
}

// Same shape as the primary generation schema — kept as a separate literal
// (not re-exported) so this file's contract doesn't silently drift if the
// primary schema changes.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    questions: { type: "array", items: { type: "object" } },
  },
  required: ["title", "questions"],
} as const;

export const FOLLOWUP_QUIZ_PROMPT: PromptDefinition<FollowupQuizInput, QuizGenerationOutput> = {
  version: "1.0.0",
  feature: "quiz.followup",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  responseSchema: RESPONSE_SCHEMA,
  generation: {
    temperature: 0.65,
    maxOutputTokens: 4096,
  },
};
