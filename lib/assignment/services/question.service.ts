// lib/assignment/services/question.service.ts
// Turns a StructuredExtraction's fullText into classified DetectedQuestion[]
// by combining the deterministic segmentation heuristic (utils/question-parser.ts)
// with the AI classification prompt (prompts/question-detection.ts), then
// cross-checking difficulty with the deterministic estimator.

import { randomUUID } from "crypto";
import type { DetectedQuestion, StructuredExtraction } from "../models/types";
import { splitIntoCandidateQuestions, batchCandidateBlocks } from "../utils/question-parser";
import { questionDetectionPrompt } from "../prompts/question-detection";
import { runAssignmentPrompt } from "../providers/ai-engine.provider";
import { extractDifficultySignals, estimateDifficulty, reconcileDifficulty } from "../utils/difficulty-estimator";
import { extractKeywords } from "../utils/keyword-extractor";

export interface DetectQuestionsOptions {
  userId: string;
  fileId: string;
}

export async function detectQuestions(
  extraction: StructuredExtraction,
  options: DetectQuestionsOptions
): Promise<{ questions: DetectedQuestion[]; detectedSubjectArea: string }> {
  const candidates = splitIntoCandidateQuestions(extraction.fullText);
  if (candidates.length === 0) {
    return { questions: [], detectedSubjectArea: "unknown" };
  }

  const batches = batchCandidateBlocks(candidates);
  const allQuestions: DetectedQuestion[] = [];
  const subjectAreaVotes = new Map<string, number>();

  for (const batch of batches) {
    const batchText = batch.map((b) => b.text).join("\n\n");

    const result = await runAssignmentPrompt(
      questionDetectionPrompt,
      { text: batchText },
      { userId: options.userId }
    );

    subjectAreaVotes.set(
      result.detectedSubjectArea,
      (subjectAreaVotes.get(result.detectedSubjectArea) ?? 0) + result.questions.length
    );

    for (const raw of result.questions) {
      const signals = extractDifficultySignals(raw.rawText, raw.marks);
      const heuristicDifficulty = estimateDifficulty(signals);
      const { final: difficulty } = reconcileDifficulty(raw.difficulty, heuristicDifficulty);

      const aiKeywords = raw.keywords.length > 0 ? raw.keywords : [];
      const heuristicKeywords = extractKeywords(raw.rawText, 8);
      const mergedKeywords = Array.from(new Set([...aiKeywords, ...heuristicKeywords])).slice(0, 10);

      allQuestions.push({
        id: randomUUID(),
        fileId: options.fileId,
        questionNumber: raw.questionNumber,
        rawText: raw.rawText,
        cleanedText: raw.rawText.trim(),
        type: raw.type,
        marks: raw.marks,
        difficulty,
        subject: raw.subject,
        topic: raw.topic,
        subtopic: raw.subtopic,
        keywords: mergedKeywords,
        expectedAnswerType: raw.expectedAnswerType,
        programmingLanguage: raw.programmingLanguage,
        mcqOptions: raw.mcqOptions,
        relatedTableIds: linkRelatedEntities(raw.rawText, extraction.tables.map((t) => t.id), extraction),
        relatedEquationIds: extraction.equations
          .filter((eq) => raw.rawText.includes(eq.raw.slice(0, 20)))
          .map((eq) => eq.id),
        relatedFigureIds: [],
        confidence: 0.85,
      });
    }
  }

  const detectedSubjectArea =
    Array.from(subjectAreaVotes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

  return { questions: allQuestions, detectedSubjectArea };
}

/** Heuristically links a question to tables it appears to reference (e.g.
 * "refer to Table 2 above") — cheap string proximity, not AI-driven, so it
 * never adds latency to the classification pass. */
function linkRelatedEntities(
  questionText: string,
  tableIds: string[],
  extraction: StructuredExtraction
): string[] {
  const mentionsTable = /table\s*\d+/i.test(questionText);
  if (!mentionsTable || extraction.tables.length === 0) return [];
  // Without page-level proximity data we conservatively link only when there
  // is exactly one table candidate — avoids false positives across a
  // multi-table document.
  const onlyTable = extraction.tables.length === 1 ? extraction.tables[0] : undefined;
  return onlyTable ? [onlyTable.id] : [];
}
