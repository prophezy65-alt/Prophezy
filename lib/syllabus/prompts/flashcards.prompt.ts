/**
 * lib/syllabus/prompts/flashcards.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { TopicDifficulty } from '../models/syllabus.types';

export interface FlashcardsPromptInput {
  topic: string;
  subjectContext: string;
  count: number;
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
  difficulty: TopicDifficulty;
}

export const flashcardsPrompt: PromptDefinition<FlashcardsPromptInput, { cards: GeneratedFlashcard[] }> = {
  version: '1',
  feature: 'syllabus.flashcards',
  systemPrompt: `You are an expert at writing active-recall flashcards for exam
preparation. Each card's front must be a single, unambiguous question or
prompt (never a fill-in-the-blank statement) and the back must be a
concise, complete answer — not a paragraph copied from a textbook. Cover
a genuine spread of difficulty (easy/moderate/hard), and never write two
cards that test the same fact.`,
  buildUserPrompt: (input: FlashcardsPromptInput) => `Subject context: ${input.subjectContext}
Topic: ${input.topic}
Generate exactly ${input.count} distinct flashcards covering this topic,
with a mix of easy/moderate/hard difficulty.`,
  responseSchema: {
    type: 'object',
    required: ['cards'],
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          required: ['front', 'back', 'difficulty'],
          properties: {
            front: { type: 'string' },
            back: { type: 'string' },
            difficulty: { type: 'string', enum: ['easy', 'moderate', 'hard'] },
          },
        },
      },
    },
  },
  generation: { temperature: 0.5, maxOutputTokens: 3072 },
};
