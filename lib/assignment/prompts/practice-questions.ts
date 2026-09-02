// lib/assignment/prompts/practice-questions.ts
import { PromptDefinition, withJsonSuffix, isPlainObject, isStringArray } from "./_shared";

export interface PracticeQuestionsResponse {
  followUpQuestions: string[];
  vivaQuestions: string[];
  interviewQuestions: string[];
}

const SCHEMA = `{
  "followUpQuestions": string[],
  "vivaQuestions": string[],
  "interviewQuestions": string[]
}`;

const SYSTEM_PROMPT = withJsonSuffix(
  `You generate three distinct sets of questions from a topic/question+solution, each
serving a different purpose:

1. followUpQuestions (4-6): additional practice problems of similar or slightly
   increasing difficulty, testing the SAME underlying concept from different angles.
   These should be genuinely new problems, not rephrasings of the original question.
2. vivaQuestions (4-6): oral-exam style questions a professor might ask to verify the
   student actually understands the material, not just memorized the answer — probing
   "why" and "what if" rather than "what".
3. interviewQuestions (4-6): questions a technical/academic interviewer might ask about
   this topic in a job interview context, framed for practical/applied understanding
   rather than pure theory.

Each list should feel meaningfully different from the others, not the same questions
reworded three times.`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const topic = typeof input.topic === "string" ? input.topic : "";
  const context = typeof input.context === "string" ? input.context : "";
  return `Topic: ${topic}\n\nContext (question and/or solution this is based on):\n${context}`;
}

function validate(parsed: unknown): parsed is PracticeQuestionsResponse {
  if (!isPlainObject(parsed)) return false;
  return (
    isStringArray(parsed.followUpQuestions) &&
    isStringArray(parsed.vivaQuestions) &&
    isStringArray(parsed.interviewQuestions)
  );
}

export const practiceQuestionsPrompt: PromptDefinition<PracticeQuestionsResponse> = {
  id: "assignment.practice_questions.generate",
  feature: "assignment_practice",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.5,
  maxOutputTokens: 4096,
  validate,
};
