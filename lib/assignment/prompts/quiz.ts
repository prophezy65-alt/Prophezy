// lib/assignment/prompts/quiz.ts
import { PromptDefinition, withJsonSuffix, isPlainObject } from "./_shared";

export interface QuizQuestionRaw {
  type: "mcq" | "true_false" | "short_answer";
  prompt: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
}

export interface QuizResponse {
  questions: QuizQuestionRaw[];
}

const SCHEMA = `{
  "questions": [{
    "type": "mcq"|"true_false"|"short_answer",
    "prompt": string,
    "options": string[]|null,
    "correctAnswer": string,
    "explanation": string
  }]
}`;

const SYSTEM_PROMPT = withJsonSuffix(
  `You are a quiz author generating a self-assessment quiz from academic source material.

Rules:
- type "mcq": exactly 4 plausible options in "options", one clearly correct. Distractors
  must be genuinely plausible (common misconceptions or near-misses), not obviously wrong.
- type "true_false": options must be exactly ["True", "False"].
- type "short_answer": options is null; correctAnswer is the expected short answer (a
  phrase or sentence, not an essay).
- explanation: a brief (1-3 sentence) reason the correct answer is correct — this is
  shown to the student AFTER they answer, so it should teach, not just confirm.
- Vary difficulty across the set: include some recall-level and some application-level
  questions when the source material supports it.
- Every question must be answerable strictly from the given source material — do not
  introduce outside facts.`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const sourceText = typeof input.sourceText === "string" ? input.sourceText : "";
  const questionCount = typeof input.questionCount === "number" ? input.questionCount : 5;
  const difficultyMix = typeof input.difficultyMix === "string" ? input.difficultyMix : "mixed";
  return `Source material:\n\n${sourceText}\n\nGenerate exactly ${questionCount} quiz questions. Difficulty mix: ${difficultyMix}.`;
}

function validate(parsed: unknown): parsed is QuizResponse {
  if (!isPlainObject(parsed)) return false;
  if (!Array.isArray(parsed.questions)) return false;
  return parsed.questions.every((q) => {
    if (!isPlainObject(q)) return false;
    if (!["mcq", "true_false", "short_answer"].includes(q.type as string)) return false;
    if (typeof q.prompt !== "string") return false;
    if (q.options !== null && !Array.isArray(q.options)) return false;
    if (typeof q.correctAnswer !== "string") return false;
    if (typeof q.explanation !== "string") return false;
    return true;
  });
}

export const quizPrompt: PromptDefinition<QuizResponse> = {
  id: "assignment.quiz.generate",
  feature: "assignment_quiz",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.4,
  maxOutputTokens: 4096,
  validate,
};
