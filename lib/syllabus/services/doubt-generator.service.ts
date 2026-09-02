/**
 * lib/syllabus/services/doubt-generator.service.ts
 */

import { randomUUID } from 'crypto';
import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { doubtsPrompt } from '../prompts/doubts.prompt';
import type { DoubtCategory, DoubtSet, ExtractedSyllabus } from '../models/syllabus.types';

const DEFAULT_CATEGORIES: DoubtCategory[] = ['viva', 'interview', 'lab', 'concept'];

export async function generateDoubts(
  userId: string,
  syllabus: ExtractedSyllabus,
  topics: string[],
  options?: { categories?: DoubtCategory[]; countPerCategory?: number },
): Promise<DoubtSet> {
  const categories = options?.categories ?? DEFAULT_CATEGORIES;
  const countPerCategory = options?.countPerCategory ?? 5;

  const generated = await runSyllabusPrompt(doubtsPrompt, {
    subjectContext: `${syllabus.subjectName} (${syllabus.courseCode ?? 'no code'})`,
    topics,
    categories,
    countPerCategory,
  }, { userId });

  return {
    syllabusId: syllabus.id,
    doubts: generated.doubts.map((d) => ({ id: randomUUID(), ...d })),
    generatedAt: new Date().toISOString(),
  };
}
