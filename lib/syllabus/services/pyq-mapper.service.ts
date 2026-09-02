/**
 * lib/syllabus/services/pyq-mapper.service.ts
 */

import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { pyqMapperPrompt } from '../prompts/pyq-mapper.prompt';
import type { ExtractedSyllabus, PyqMapResult } from '../models/syllabus.types';

export async function mapPreviousYearQuestions(
  userId: string,
  syllabus: ExtractedSyllabus,
  previousYearQuestionsText: string,
): Promise<PyqMapResult> {
  const generated = await runSyllabusPrompt(pyqMapperPrompt, {
    syllabus,
    previousYearQuestionsText,
  }, { userId });

  const coveredCount = generated.entries.filter((e) => e.coverageStatus === 'covered').length;
  const partialCount = generated.entries.filter(
    (e) => e.coverageStatus === 'partially_covered',
  ).length;
  const notCoveredCount = generated.entries.filter(
    (e) => e.coverageStatus === 'not_covered',
  ).length;
  const total = generated.entries.length || 1;

  return {
    syllabusId: syllabus.id,
    entries: generated.entries,
    coverageSummary: {
      coveredCount,
      partialCount,
      notCoveredCount,
      coveragePercent: Math.round(((coveredCount + partialCount * 0.5) / total) * 100),
    },
    generatedAt: new Date().toISOString(),
  };
}
