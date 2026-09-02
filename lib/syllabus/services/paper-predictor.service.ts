/**
 * lib/syllabus/services/paper-predictor.service.ts
 *
 * The real Exam Predictor entry point — this is the file that was
 * missing when Exam Predictor was previously reported as "no
 * implementation exists to connect to." It was in lib/syllabus/, not
 * lib/exam-predictor/ (which only has a file-format detector) — same
 * "real feature lives in a different module than its own directory
 * name" pattern already found for ATS, Interview, Research, and Career.
 *
 * CREDIT GATING (added): EXAM_PREDICTOR (4 credits), spent BEFORE
 * runSyllabusPrompt() — which delegates straight to the same
 * runStructured() primitive used by Notes/Resume/Career (throws on
 * failure, doesn't swallow), so the standard spendCreditsForFeature
 * wrapper fits cleanly — no manual refund plumbing needed like ATS or
 * Career Advisor required.
 */

import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { paperPredictorPrompt } from '../prompts/paper-predictor.prompt';
import type { ExtractedSyllabus, PaperPrediction } from '../models/syllabus.types';
import { spendCreditsForFeature, getFeatureCreditCost, CREDIT_FEATURES } from '@/lib/credits';

export async function predictPaper(
  userId: string,
  syllabus: ExtractedSyllabus,
  previousYearQuestionsText?: string,
  questionCount?: number,
): Promise<PaperPrediction> {
  const feature = CREDIT_FEATURES.EXAM_PREDICTOR;
  const cost = await getFeatureCreditCost(feature);
  if (!cost) {
    throw new Error(`Exam Predictor is temporarily unavailable (no active credit cost configured for "${feature}").`);
  }

  const generated = await spendCreditsForFeature(
    userId,
    cost.creditCost,
    feature,
    () => runSyllabusPrompt(paperPredictorPrompt, { syllabus, previousYearQuestionsText, questionCount }, { userId }),
    'Exam Predictor question prediction'
  );

  return {
    syllabusId: syllabus.id,
    ...generated,
    generatedAt: new Date().toISOString(),
  };
}
