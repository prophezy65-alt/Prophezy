/**
 * lib/syllabus/services/notes.service.ts
 */

import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { notesPrompt } from '../prompts/notes.prompt';
import type { ExtractedSyllabus, NotesResult, NotesVariant } from '../models/syllabus.types';

export async function generateNotes(
  userId: string,
  syllabus: ExtractedSyllabus,
  topic: string,
  variant: NotesVariant,
): Promise<NotesResult> {
  const generated = await runSyllabusPrompt(notesPrompt, {
    topic,
    variant,
    subjectContext: `${syllabus.subjectName} (${syllabus.courseCode ?? 'no code'})`,
  }, { userId });

  return {
    syllabusId: syllabus.id,
    topic,
    variant,
    content: generated.content ?? '',
    mindMap: generated.mindMap,
    generatedAt: new Date().toISOString(),
  };
}
