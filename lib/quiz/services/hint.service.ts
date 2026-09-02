/**
 * lib/quiz/services/hint.service.ts
 *
 * Level 1 hint is free — it's generated alongside the question and stored
 * in quiz_questions.hint, so this is a plain read, no AI call. Levels 2-3
 * call the AI (hint.prompt.ts) on demand and are not persisted, since
 * they're a per-attempt aid, not part of the question's canonical content.
 */

import { runStructured } from "../../ai/services/_run-structured";
import { HINT_PROMPT } from "../prompts/hint.prompt";
import type { QuizQuestion } from "../models/quiz.types";

export interface HintRequest {
  userId: string;
  question: QuizQuestion;
  level: 1 | 2 | 3;
  previousHints: string[]; // required for level 2/3, ignored for level 1
}

export async function getHint(request: HintRequest): Promise<string> {
  if (request.level === 1) {
    if (!request.question.hint) {
      throw new Error(`Question ${request.question.id} has no base hint stored.`);
    }
    return request.question.hint;
  }

  const result = await runStructured(HINT_PROMPT, {
    userId: request.userId,
    input: {
      questionText: request.question.questionText,
      previousHints: request.previousHints,
      hintLevel: request.level,
    },
  });

  return result.hint;
}
