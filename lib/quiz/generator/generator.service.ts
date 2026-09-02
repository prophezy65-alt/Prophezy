/**
 * lib/quiz/generator/generator.service.ts
 *
 * Orchestrates quiz generation end-to-end:
 *   1. resolve source content (upload / topic / url / text / existing generation)
 *   2. call the AI via runStructured() + quiz-generation.prompt.ts
 *   3. validate every question against question-schemas.ts
 *   4. normalize into quiz_questions rows (grading_method, metadata shape)
 *   5. persist via the provider
 *
 * Never calls runAI directly — always through runStructured, per the AI
 * Core Engine contract. Never duplicates OCR/parsing — reuses
 * ocr.service.ts and the existing document_chunks pipeline for content.
 */

import { runStructured } from "../../ai/services/_run-structured";
import { ocrImage } from "../../ai/services/ocr.service";
import { QUIZ_GENERATION_PROMPT } from "../prompts/quiz-generation.prompt";
import { FOLLOWUP_QUIZ_PROMPT } from "../prompts/followup-quiz.prompt";
import { questionSchema } from "../validation/question-schemas";
import { generateQuizRequestSchema, type GenerateQuizRequest } from "../validation/quiz-schemas";
import { GRADING_METHOD_BY_TYPE, type QuestionMetadata, type QuizQuestionType, type Quiz, type QuizQuestion } from "../models/quiz.types";
import * as provider from "../providers/supabase-quiz.provider";
import { AIValidationError } from "../../ai/utils/errors";

/** Resolves any supported source type down to plain text the prompt can consume. */
async function resolveSourceContent(source: GenerateQuizRequest["source"], userId: string): Promise<string> {
  switch (source.sourceType) {
    case "upload":
      return provider.getUploadChunksText(source.uploadId);
    case "generation":
      return provider.getGenerationContent(source.generationId);
    case "topic":
      // No document to extract — the prompt generates from the model's own
      // knowledge of the topic, same as "Custom Topics" in the feature list.
      return `Topic: ${source.topic}\n\n(No source document provided — generate questions from general subject-matter knowledge of this topic.)`;
    case "text":
      return source.text;
    case "url": {
      // Fetching + cleaning arbitrary URLs is the Research AI module's job —
      // reuse it rather than duplicating a fetcher here.
      const { fetchAndExtractUrlText } = await import("../../research/research.service");
      return fetchAndExtractUrlText(source.url);
    }
    default: {
      const _exhaustive: never = source;
      throw new Error(`Unsupported source type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Turns one AI-generated question (already zod-validated) into a DB-ready row shape. */
function normalizeQuestion(q: any): Record<string, unknown> {
  const questionType = q.questionType as QuizQuestionType;
  const gradingMethod = GRADING_METHOD_BY_TYPE[questionType];

  const metadata: QuestionMetadata = (() => {
    switch (questionType) {
      case "match_following":
        return { kind: "match_following", pairs: q.pairs };
      case "ordering":
        return { kind: "ordering", items: q.items, correctOrder: q.correctOrder };
      case "multiple_select":
        return { kind: "multiple_select", options: q.options, correctOptions: q.correctOptions };
      case "programming":
      case "debugging":
      case "sql":
      case "coding_challenge":
        return {
          kind: "code",
          language: q.language,
          starterCode: q.starterCode,
          testCases: q.testCases,
          ...(questionType === "debugging" ? { buggyCode: q.buggyCode } : {}),
          ...(questionType === "sql" ? { schemaContext: q.schemaContext } : {}),
          ...(questionType === "coding_challenge" ? { constraints: q.constraints } : {}),
        } as QuestionMetadata;
      case "short_answer":
      case "long_answer":
      case "essay":
      case "case_study":
      case "mathematics":
      case "physics":
      case "chemistry":
      case "biology":
      case "engineering":
      case "medical":
      case "law":
      case "business":
      case "ai_ml":
        return {
          kind: "subject_response",
          modelSolution: q.modelSolution,
          rubric: q.rubric,
          ...(questionType === "case_study" ? { scenario: q.scenario } : {}),
        } as QuestionMetadata;
      default:
        return { kind: "generic" };
    }
  })();

  return {
    questionText: q.questionText,
    questionType,
    gradingMethod,
    difficulty: q.difficulty,
    marks: q.marks,
    options: questionType === "mcq" || questionType === "true_false" ? q.options ?? null : null,
    correctOption: q.correctOption ?? (questionType === "true_false" ? q.correctOption : null),
    hint: q.hint ?? null,
    explanation: q.explanation ?? null,
    stepSolution: q.stepSolution ?? null,
    topicId: null, // topic assignment happens post-hoc via topic-analyzer if topicIds were requested
    conceptTags: q.conceptTags ?? [],
    metadata,
  };
}

export interface GenerateQuizResult {
  quiz: Quiz;
  questions: QuizQuestion[];
  estimatedTimeSec: number;
}

/**
 * Two-step by design: generation (AI call + validation) is separated from
 * persistence because persisting requires a `generations` row id, and that
 * row (kind='quiz' | 'mcqs', shared across every AI feature per
 * 0007_notes.sql) is owned by the existing generation-orchestration flow —
 * not duplicated here. Typical caller flow (in an API route):
 *
 *   const { title, validatedQuestions } = await generateAndValidateQuiz(request);
 *   const generation = await createGenerationRow(userId, "quiz", title, uploadId); // existing flow
 *   const result = await persistGeneratedQuiz({ generationId: generation.id, ...request, title, validatedQuestions });
 */
export async function persistGeneratedQuiz(params: {
  generationId: string;
  title: string;
  examMode: GenerateQuizRequest["examMode"];
  difficulty: GenerateQuizRequest["difficulty"];
  isAdaptive: boolean;
  timeLimitSec: number | null;
  negativeMarking: number;
  topicIds: string[];
  sourceUploadId: string | null;
  validatedQuestions: Array<Record<string, unknown>>;
}): Promise<GenerateQuizResult> {
  const quiz = await provider.insertQuiz({
    generationId: params.generationId,
    title: params.title,
    examMode: params.examMode,
    difficulty: params.difficulty,
    isAdaptive: params.isAdaptive,
    timeLimitSec: params.timeLimitSec,
    negativeMarking: params.negativeMarking,
    topicIds: params.topicIds,
    sourceUploadId: params.sourceUploadId,
    questionCount: params.validatedQuestions.length,
  });

  const normalized = params.validatedQuestions.map(normalizeQuestion);
  const questions = await provider.insertQuestions(quiz.id, normalized);

  const { estimateCompletionTimeSec } = await import("../utils/topic-analyzer");
  const estimatedTimeSec = estimateCompletionTimeSec(questions);

  return { quiz, questions, estimatedTimeSec };
}

/**
 * Generates a full quiz and validates it, without persisting — for callers that need to review generationId flow first.
 *
 * Backfills automatically: if some AI-generated questions fail schema
 * validation (e.g. an incomplete or ambiguous answer key), rather than
 * silently handing back fewer questions than the student asked for, this
 * re-prompts the model for just the shortfall — passing along the
 * already-accepted question texts so it doesn't repeat itself — up to
 * MAX_BACKFILL_ROUNDS additional attempts. A quiz only ends up shorter
 * than requested if the source content genuinely can't sustain that many
 * distinct, high-quality questions even after those retries (e.g. a
 * one-paragraph upload asked to produce 30 questions).
 */
const MAX_BACKFILL_ROUNDS = 3;

export async function generateAndValidateQuiz(request: GenerateQuizRequest) {
  const input = generateQuizRequestSchema.parse(request);
  const sourceContent = await resolveSourceContent(input.source, input.userId);

  const validatedQuestions: Array<Record<string, unknown>> = [];
  const allDropped: Array<{ round: number; index: number; issues: unknown }> = [];
  let quizTitle: string | undefined;

  for (let round = 0; round <= MAX_BACKFILL_ROUNDS; round++) {
    const remaining = input.questionCount - validatedQuestions.length;
    if (remaining <= 0) break;

    const generated = await runStructured(QUIZ_GENERATION_PROMPT, {
      userId: input.userId,
      input: {
        sourceContent,
        title: input.title,
        examMode: input.examMode,
        difficulty: input.difficulty,
        isAdaptive: input.isAdaptive,
        questionTypes: input.questionTypes,
        questionCount: remaining,
        // Only sent on backfill rounds, so the model tops up with genuinely
        // new questions instead of rephrasing ones already accepted.
        avoidQuestionTexts:
          round > 0 ? validatedQuestions.map((q) => String((q as { questionText?: unknown }).questionText ?? "")) : undefined,
      },
    });

    if (round === 0) quizTitle = generated.title;

    let acceptedThisRound = 0;
    generated.questions.forEach((q: any, index: number) => {
      const result = questionSchema.safeParse(q);
      if (result.success) {
        validatedQuestions.push(result.data);
        acceptedThisRound++;
      } else {
        allDropped.push({ round, index, issues: result.error.issues });
      }
    });

    // A round that produced nothing usable means the source content likely
    // can't sustain more distinct questions — stop retrying rather than
    // burning further AI calls for no gain.
    if (acceptedThisRound === 0 && generated.questions.length === 0) break;
  }

  if (allDropped.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[quiz generator] dropped ${allDropped.length} AI-generated question(s) across ${
        Math.max(...allDropped.map((d) => d.round)) + 1
      } round(s) that failed schema validation:`,
      JSON.stringify(allDropped, null, 2),
    );
  }

  if (validatedQuestions.length === 0) {
    throw new AIValidationError(
      `None of the generated question(s) passed schema validation after ${MAX_BACKFILL_ROUNDS + 1} attempt(s).`,
      allDropped,
    );
  }

  return {
    title: quizTitle ?? "Untitled Quiz",
    validatedQuestions: validatedQuestions.slice(0, input.questionCount),
    requestedCount: input.questionCount,
    droppedCount: Math.max(0, input.questionCount - validatedQuestions.length),
  };
}
export async function generateFollowupQuiz(params: {
  userId: string;
  sourceContent: string;
  weakTopics: string[];
  missedQuestionTexts: string[];
  difficulty: GenerateQuizRequest["difficulty"];
  questionTypes: QuizQuestionType[];
  questionCount: number;
}) {
  const generated = await runStructured(FOLLOWUP_QUIZ_PROMPT, {
    userId: params.userId,
    input: {
      sourceContent: params.sourceContent,
      weakTopics: params.weakTopics,
      missedQuestionTexts: params.missedQuestionTexts,
      difficulty: params.difficulty,
      questionTypes: params.questionTypes,
      questionCount: params.questionCount,
    },
  });

  const validatedQuestions = generated.questions.map((q: any, index: number) => {
    const result = questionSchema.safeParse(q);
    if (!result.success) {
      throw new AIValidationError(`Follow-up question at index ${index} failed schema validation.`, result.error.issues);
    }
    return result.data;
  });

  return { title: generated.title, validatedQuestions };
}

// Re-exported so API routes/OCR-sourced uploads (scanned PDFs, images of
// question papers) can go through the existing OCR service without
// generator.service.ts needing its own image-handling logic.
export { ocrImage };
