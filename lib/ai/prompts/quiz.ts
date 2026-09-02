/**
 * lib/ai/prompts/quiz.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface QuizInput {
  sourceText: string;
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
}

export interface QuizOutput {
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

export const QUIZ_PROMPT: PromptDefinition<QuizInput, QuizOutput> = {
  version: "quiz.v1",
  feature: "quiz",
  systemPrompt:
    "You write multiple-choice quiz questions from study material. Each " +
    "question has exactly 4 options, exactly one of which is correct. " +
    "Distractors must be plausible (not obviously wrong) but unambiguously " +
    "incorrect. Include a short explanation of why the correct answer is " +
    "right. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      wrapUserContent("source_text", input.sourceText),
      "Question count: " + (input.questionCount ?? 10),
      "Difficulty: " + (input.difficulty ?? "mixed"),
    ].join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctIndex: { type: "number" },
            explanation: { type: "string" },
          },
          required: ["question", "options", "correctIndex", "explanation"],
        },
      },
    },
    required: ["questions"],
  },
  generation: { temperature: 0.4, maxOutputTokens: 3072 },
};
