/**
 * lib/syllabus/services/revision.service.ts
 */

import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { revisionPrompt } from '../prompts/revision.prompt';
import type { ExtractedSyllabus, RevisionMode, RevisionPack } from '../models/syllabus.types';

export async function generateRevisionPack(
  userId: string,
  syllabus: ExtractedSyllabus,
  mode: RevisionMode,
  topics: string[],
): Promise<RevisionPack> {
  const generated = await runSyllabusPrompt(revisionPrompt, {
    mode,
    subjectContext: `${syllabus.subjectName} (${syllabus.courseCode ?? 'no code'})`,
    topics,
  }, { userId });

  return {
    syllabusId: syllabus.id,
    mode,
    content: generated.content,
    keyFormulas: generated.keyFormulas,
    generatedAt: new Date().toISOString(),
  };
}
