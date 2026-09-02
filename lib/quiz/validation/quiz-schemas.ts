/**
 * lib/quiz/validation/quiz-schemas.ts
 *
 * Request/response validation for the quiz engine's public surface:
 * generate, submit attempt, grade. Question-level shapes live in
 * question-schemas.ts — this file composes them into whole-quiz payloads.
 */

import { z } from "zod";
import { questionSchema } from "./question-schemas";

export const questionTypeEnum = z.enum([
  "mcq", "true_false", "fill_in_blank", "one_word", "multiple_select",
  "match_following", "ordering", "short_answer", "long_answer", "essay",
  "case_study", "programming", "debugging", "sql", "mathematics", "physics",
  "chemistry", "biology", "engineering", "medical", "law", "business",
  "ai_ml", "coding_challenge",
]);

export const difficultyEnum = z.enum(["easy", "medium", "hard", "expert"]);

export const examModeEnum = z.enum([
  "practice", "timed_test", "mock_exam", "competitive_exam", "revision_test",
  "chapter_test", "unit_test", "semester_exam", "final_exam", "custom_exam",
]);

export const sourceInputSchema = z.discriminatedUnion("sourceType", [
  z.object({ sourceType: z.literal("upload"), uploadId: z.string().uuid() }),
  z.object({ sourceType: z.literal("topic"), topic: z.string().min(2) }),
  z.object({ sourceType: z.literal("url"), url: z.string().url() }),
  z.object({ sourceType: z.literal("text"), text: z.string().min(20) }),
  z.object({ sourceType: z.literal("generation"), generationId: z.string().uuid() }), // notes/flashcards/assignment/syllabus already generated
]);

/** Input to generator.service.ts#generateQuiz */
export const generateQuizRequestSchema = z.object({
  userId: z.string().uuid(),
  source: sourceInputSchema,
  title: z.string().min(1).max(200).optional(),
  examMode: examModeEnum.default("practice"),
  difficulty: difficultyEnum.default("medium"),
  isAdaptive: z.boolean().default(false),
  questionTypes: z.array(questionTypeEnum).min(1),
  questionCount: z.number().int().min(1).max(100),
  timeLimitSec: z.number().int().min(30).nullable().optional(),
  negativeMarking: z.number().min(0).max(1).default(0),
  topicIds: z.array(z.string().uuid()).default([]),
});
export type GenerateQuizRequest = z.infer<typeof generateQuizRequestSchema>;

/** Shape returned by the AI generation prompt, validated before persistence. */
export const generatedQuizSchema = z.object({
  title: z.string().min(1),
  questions: z.array(questionSchema).min(1),
});
export type GeneratedQuiz = z.infer<typeof generatedQuizSchema>;

/** Input to grading.service.ts#submitResponse (one question at a time, for live-save-as-you-go UX) */
export const submitResponseSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  response: z.union([
    z.string(),
    z.array(z.string()),
    z.array(z.object({ left: z.string(), right: z.string() })),
    z.null(),
  ]),
  timeSpentSec: z.number().int().min(0).optional(),
  hintUsed: z.boolean().default(false),
});
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;

/** Input to grading.service.ts#submitAttempt (finalize + score) */
export const submitAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

/** Input to quiz.service.ts#startAttempt */
export const startAttemptSchema = z.object({
  quizId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type StartAttemptInput = z.infer<typeof startAttemptSchema>;

/** Input to export.service.ts#exportQuiz */
export const exportFormatEnum = z.enum(["pdf", "docx", "json", "csv", "markdown", "html"]);
export const exportQuizRequestSchema = z.object({
  quizId: z.string().uuid(),
  userId: z.string().uuid(),
  format: exportFormatEnum,
  includeAnswers: z.boolean().default(false),
});
export type ExportQuizRequest = z.infer<typeof exportQuizRequestSchema>;
