// lib/assignment/services/generator.service.ts
// Produces a full QuestionSolution for a DetectedQuestion via the solution
// prompt, then assembles reference citation strings (citation.service.ts
// handles formatting) and returns the fully-typed domain object used by
// export/ and the frontend.

import type { DetectedQuestion, QuestionSolution, ReferenceEntry } from "../models/types";
import { solutionPrompt, shortSolutionPrompt } from "../prompts/solution";
import { runAssignmentPrompt } from "../providers/ai-engine.provider";
import { formatCitation } from "./citation.service";
import { randomUUID } from "crypto";

export type ExplanationDepth = "simple" | "standard" | "technical";
/** "full" = the rich tutoring solution (explanation, approach, steps,
 * diagrams, glossary, references) — 15-30s+, meant for a single on-demand
 * "Solve" click. "short" = an exam-answer-key entry only — much faster and
 * cheaper, meant for solving every question in a document up front. */
export type SolutionMode = "full" | "short";

export interface GenerateSolutionOptions {
  userId: string;
  depthMode?: ExplanationDepth;
  mode?: SolutionMode;
}

export async function generateSolution(
  question: DetectedQuestion,
  options: GenerateSolutionOptions
): Promise<QuestionSolution> {
  if ((options.mode ?? "full") === "short") {
    return generateShortSolution(question, options);
  }

  const result = await runAssignmentPrompt(
    solutionPrompt,
    {
      questionText: question.cleanedText,
      subject: question.subject,
      topic: question.topic,
      type: question.type,
      marks: question.marks,
      programmingLanguage: question.programmingLanguage,
      depthMode: options.depthMode ?? "standard",
    },
    { userId: options.userId }
  );

  const references: ReferenceEntry[] = result.suggestedReferences.map((ref) => {
    const id = randomUUID();
    return {
      id,
      type: ref.type,
      title: ref.title,
      authors: ref.authors,
      year: ref.year,
      publisher: ref.publisher,
      url: ref.url,
      citationText: formatCitation({
        type: ref.type,
        title: ref.title,
        authors: ref.authors,
        year: ref.year,
        publisher: ref.publisher,
        url: ref.url,
      }),
    };
  });

  return {
    questionId: question.id,
    explanationOfQuestion: result.explanationOfQuestion,
    approach: result.approach,
    steps: result.steps.map((s) => ({
      stepNumber: s.stepNumber,
      title: s.title,
      explanation: s.explanation,
      formula: s.formula ?? undefined,
      code: s.code ?? undefined,
      codeLanguage: s.codeLanguage ?? undefined,
    })),
    finalAnswer: result.finalAnswer,
    keyConcepts: result.keyConcepts,
    mermaidDiagrams: result.mermaidDiagrams,
    pseudocode: result.pseudocode,
    code: result.code,
    references,
    glossary: result.glossary,
    generatedAt: new Date().toISOString(),
    modelUsed: "gemini-2.5-pro-via-core-engine",
  };
}

/** Fast path: an exam-answer-key entry, not a tutoring solution. Still
 * returns a full QuestionSolution (with the tutoring-only fields left
 * empty) so every existing consumer — export, the detail view, etc. —
 * keeps working without changes; they'll just render those sections empty
 * for a short-mode solution. */
async function generateShortSolution(
  question: DetectedQuestion,
  options: GenerateSolutionOptions
): Promise<QuestionSolution> {
  const result = await runAssignmentPrompt(
    shortSolutionPrompt,
    {
      questionText: question.cleanedText,
      subject: question.subject,
      type: question.type,
      marks: question.marks,
      programmingLanguage: question.programmingLanguage,
    },
    { userId: options.userId }
  );

  return {
    questionId: question.id,
    explanationOfQuestion: "",
    approach: result.workingSummary,
    steps: [],
    finalAnswer: result.finalAnswer,
    keyConcepts: [],
    mermaidDiagrams: [],
    pseudocode: null,
    code: result.keyFormulaOrCode
      ? { language: question.programmingLanguage ?? "text", content: result.keyFormulaOrCode }
      : null,
    references: [],
    glossary: [],
    generatedAt: new Date().toISOString(),
    modelUsed: "gemini-2.5-pro-via-core-engine",
  };
}

export interface GenerateSolutionsForDocumentResult {
  solutions: QuestionSolution[];
  /** Questions that failed to solve — surfaced instead of silently dropped,
   * so the caller can save what succeeded and let the student retry just
   * the ones that didn't (per-question, via the existing solution route)
   * rather than losing the whole batch over one bad call. */
  failed: Array<{ questionId: string; error: string }>;
}

/** Batch variant with bounded concurrency so we don't blow past the Core
 * Engine's per-user rate limit when a document has many questions.
 *
 * One question failing (safety block, malformed AI response, transient
 * network error, etc.) no longer fails the whole document — every other
 * question's solution still gets generated and returned. Callers should
 * persist `solutions` and surface `failed` to the user instead of treating
 * any failure as fatal to the upload.
 *
 * Pass `mode: "short"` for eager whole-document solving (fast, exam-answer
 * depth) vs the default "full" tutoring depth for a single on-demand solve. */
export async function generateSolutionsForDocument(
  questions: DetectedQuestion[],
  options: GenerateSolutionOptions,
  concurrency = 3
): Promise<GenerateSolutionsForDocumentResult> {
  const solutions: QuestionSolution[] = [];
  const failed: Array<{ questionId: string; error: string }> = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < questions.length) {
      const index = cursor++;
      const question = questions[index];
      if (!question) continue;
      try {
        solutions.push(await generateSolution(question, options));
      } catch (err) {
        failed.push({ questionId: question.id, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, questions.length) }, () => worker());
  await Promise.all(workers);
  return { solutions, failed };
}
