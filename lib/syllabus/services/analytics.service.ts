/**
 * lib/syllabus/services/analytics.service.ts
 */

import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { analyticsPrompt } from '../prompts/analytics.prompt';
import type {
  ChapterAnalyticsEntry,
  ExtractedSyllabus,
  SmartAnalytics,
} from '../models/syllabus.types';

const TOP_N = 5;

function topBy(entries: ChapterAnalyticsEntry[], key: keyof ChapterAnalyticsEntry): string[] {
  return [...entries]
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, TOP_N)
    .map((e) => e.chapterOrUnit);
}

export async function generateSmartAnalytics(
  userId: string,
  syllabus: ExtractedSyllabus,
  previousYearQuestionsText?: string,
): Promise<SmartAnalytics> {
  const generated = await runSyllabusPrompt(analyticsPrompt, {
    syllabus,
    previousYearQuestionsText,
  }, { userId });

  return {
    syllabusId: syllabus.id,
    entries: generated.entries,
    hardestChapters: topBy(generated.entries, 'hardnessScore'),
    longestChapters: topBy(generated.entries, 'lengthScore'),
    mostImportantChapters: topBy(generated.entries, 'importanceScore'),
    mostScoringChapters: topBy(generated.entries, 'scoringPotential'),
    mostAskedChapters: topBy(generated.entries, 'frequencyAskedScore'),
    generatedAt: new Date().toISOString(),
  };
}
