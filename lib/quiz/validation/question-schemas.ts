/**
 * lib/quiz/validation/question-schemas.ts
 *
 * One zod schema per question type's `metadata` payload (see
 * supabase/migrations/0022_quiz_engine_extend.sql for the column comment
 * this file is the source of truth for), plus a discriminated union used to
 * validate a single question end-to-end regardless of type.
 *
 * These validate AI-generated output (via lib/ai/utils/validator.ts's
 * `withZod` adapter, called from generator.service.ts) AND user-submitted
 * answers (called from grading.service.ts) — same schemas, two call sites.
 */

import { z } from "zod";
import type { QuizQuestionType } from "../models/quiz.types";

// ---- shared primitives ------------------------------------------------

const mcqOptionSchema = z.object({
  key: z.string().min(1).max(4),
  text: z.string().min(1),
});

const difficultySchema = z.enum(["easy", "medium", "hard", "expert"]);

const baseQuestionSchema = z.object({
  questionText: z.string().min(3),
  difficulty: difficultySchema,
  marks: z.number().int().min(1).max(100).default(1),
  hint: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  stepSolution: z.string().nullable().optional(),
  conceptTags: z.array(z.string()).default([]),
});

// ---- exact_match types ---------------------------------------------------

export const mcqQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("mcq"),
  options: z.array(mcqOptionSchema).min(2).max(8),
  correctOption: z.string(),
});

export const trueFalseQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("true_false"),
  correctOption: z.enum(["true", "false"]),
});

export const fillInBlankQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("fill_in_blank"),
  correctOption: z.string().min(1),
  acceptableVariants: z.array(z.string()).default([]),
});

export const oneWordQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("one_word"),
  correctOption: z.string().min(1),
  acceptableVariants: z.array(z.string()).default([]),
});

// ---- set_match types -----------------------------------------------------

export const multipleSelectQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("multiple_select"),
  options: z.array(mcqOptionSchema).min(3).max(10),
  correctOptions: z.array(z.string()).min(2),
});

export const matchFollowingQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("match_following"),
  pairs: z
    .array(z.object({ left: z.string().min(1), right: z.string().min(1) }))
    .min(3)
    .max(10),
});

export const orderingQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("ordering"),
  items: z.array(z.string().min(1)).min(3).max(10),
  correctOrder: z.array(z.number().int().min(0)),
});

// ---- ai_graded: free text types --------------------------------------

export const shortAnswerQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("short_answer"),
  modelSolution: z.string().min(1),
  rubric: z.array(z.string()).default([]),
});

export const longAnswerQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("long_answer"),
  modelSolution: z.string().min(1),
  rubric: z.array(z.string()).default([]),
});

export const essayQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("essay"),
  modelSolution: z.string().min(1),
  rubric: z.array(z.string()).min(1),
});

export const caseStudyQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("case_study"),
  scenario: z.string().min(20),
  modelSolution: z.string().min(1),
  rubric: z.array(z.string()).min(1),
});

// ---- ai_graded: code types --------------------------------------------

const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  hidden: z.boolean().default(false),
});

const codeQuestionBase = baseQuestionSchema.extend({
  language: z.string().min(1),
  starterCode: z.string().optional(),
  testCases: z.array(testCaseSchema).min(1),
});

export const programmingQuestionSchema = codeQuestionBase.extend({
  questionType: z.literal("programming"),
});

export const debuggingQuestionSchema = codeQuestionBase.extend({
  questionType: z.literal("debugging"),
  buggyCode: z.string().min(1),
});

export const sqlQuestionSchema = codeQuestionBase.extend({
  questionType: z.literal("sql"),
  schemaContext: z.string().optional(),
});

export const codingChallengeQuestionSchema = codeQuestionBase.extend({
  questionType: z.literal("coding_challenge"),
  constraints: z.array(z.string()).default([]),
});

// ---- ai_graded: subject-tagged free response -----------------------------

const subjectResponseSchema = baseQuestionSchema.extend({
  modelSolution: z.string().min(1),
  rubric: z.array(z.string()).default([]),
});

export const mathematicsQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("mathematics") });
export const physicsQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("physics") });
export const chemistryQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("chemistry") });
export const biologyQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("biology") });
export const engineeringQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("engineering") });
export const medicalQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("medical") });
export const lawQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("law") });
export const businessQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("business") });
export const aiMlQuestionSchema = subjectResponseSchema.extend({ questionType: z.literal("ai_ml") });

// ---- discriminated union --------------------------------------------------

export const questionSchema = z.discriminatedUnion("questionType", [
  mcqQuestionSchema,
  trueFalseQuestionSchema,
  fillInBlankQuestionSchema,
  oneWordQuestionSchema,
  multipleSelectQuestionSchema,
  matchFollowingQuestionSchema,
  orderingQuestionSchema,
  shortAnswerQuestionSchema,
  longAnswerQuestionSchema,
  essayQuestionSchema,
  caseStudyQuestionSchema,
  programmingQuestionSchema,
  debuggingQuestionSchema,
  sqlQuestionSchema,
  codingChallengeQuestionSchema,
  mathematicsQuestionSchema,
  physicsQuestionSchema,
  chemistryQuestionSchema,
  biologyQuestionSchema,
  engineeringQuestionSchema,
  medicalQuestionSchema,
  lawQuestionSchema,
  businessQuestionSchema,
  aiMlQuestionSchema,
]);

export type ValidatedQuestion = z.infer<typeof questionSchema>;

const SCHEMA_BY_TYPE: Record<QuizQuestionType, z.ZodTypeAny> = {
  mcq: mcqQuestionSchema,
  true_false: trueFalseQuestionSchema,
  fill_in_blank: fillInBlankQuestionSchema,
  one_word: oneWordQuestionSchema,
  multiple_select: multipleSelectQuestionSchema,
  match_following: matchFollowingQuestionSchema,
  ordering: orderingQuestionSchema,
  short_answer: shortAnswerQuestionSchema,
  long_answer: longAnswerQuestionSchema,
  essay: essayQuestionSchema,
  case_study: caseStudyQuestionSchema,
  programming: programmingQuestionSchema,
  debugging: debuggingQuestionSchema,
  sql: sqlQuestionSchema,
  coding_challenge: codingChallengeQuestionSchema,
  mathematics: mathematicsQuestionSchema,
  physics: physicsQuestionSchema,
  chemistry: chemistryQuestionSchema,
  biology: biologyQuestionSchema,
  engineering: engineeringQuestionSchema,
  medical: medicalQuestionSchema,
  law: lawQuestionSchema,
  business: businessQuestionSchema,
  ai_ml: aiMlQuestionSchema,
};

export function schemaForType(type: QuizQuestionType): z.ZodTypeAny {
  return SCHEMA_BY_TYPE[type];
}
