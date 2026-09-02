/**
 * lib/syllabus/services/flashcards.service.ts
 */

import { randomUUID } from 'crypto';
import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { flashcardsPrompt } from '../prompts/flashcards.prompt';
import type { ExtractedSyllabus, Flashcard, FlashcardSet } from '../models/syllabus.types';

// SM-2-style initial ease factor for a brand-new card.
const INITIAL_EASE_FACTOR = 2.5;

export async function generateFlashcards(
  userId: string,
  syllabus: ExtractedSyllabus,
  topic: string,
  count: number = 15,
): Promise<FlashcardSet> {
  const generated = await runSyllabusPrompt(flashcardsPrompt, {
    topic,
    subjectContext: `${syllabus.subjectName} (${syllabus.courseCode ?? 'no code'})`,
    count,
  }, { userId });

  const now = new Date().toISOString();
  const cards: Flashcard[] = generated.cards.map((card) => ({
    id: randomUUID(),
    topic,
    front: card.front,
    back: card.back,
    difficulty: card.difficulty,
    srs: {
      intervalDays: 0,
      easeFactor: INITIAL_EASE_FACTOR,
      repetitions: 0,
      dueDate: now.slice(0, 10), // due immediately on creation
    },
  }));

  return {
    syllabusId: syllabus.id,
    topic,
    cards,
    generatedAt: now,
  };
}
