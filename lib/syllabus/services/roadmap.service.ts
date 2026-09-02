/**
 * lib/syllabus/services/roadmap.service.ts
 */

import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { roadmapPrompt } from '../prompts/roadmap.prompt';
import type { ExtractedSyllabus, SmartRoadmap } from '../models/syllabus.types';

export async function generateSmartRoadmap(
  userId: string,
  syllabus: ExtractedSyllabus,
  options: { examDate?: string; hoursAvailablePerDay: number },
): Promise<SmartRoadmap> {
  const generated = await runSyllabusPrompt(roadmapPrompt, {
    syllabus,
    examDate: options.examDate,
    hoursAvailablePerDay: options.hoursAvailablePerDay,
  }, { userId });

  return {
    syllabusId: syllabus.id,
    generatedAt: new Date().toISOString(),
    examDate: options.examDate,
    ...generated,
  };
}
