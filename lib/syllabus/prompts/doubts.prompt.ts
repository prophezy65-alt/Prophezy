/**
 * lib/syllabus/prompts/doubts.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { DoubtCategory, TopicDifficulty } from '../models/syllabus.types';

export interface DoubtsPromptInput {
  subjectContext: string;
  topics: string[];
  categories: DoubtCategory[];
  countPerCategory: number;
}

export interface GeneratedDoubtItem {
  category: DoubtCategory;
  question: string;
  expectedAnswerPoints: string[];
  topic: string;
  difficulty: TopicDifficulty;
}

const CATEGORY_INSTRUCTIONS: Record<DoubtCategory, string> = {
  viva: 'Viva-voce questions an examiner would actually ask in an oral exam on this syllabus — probing understanding, not just recall.',
  interview: 'Technical interview-style questions a recruiter/panel might ask that draw on this syllabus content, framed the way an interview would frame them.',
  lab: 'Practical/lab-oriented questions: about procedure, expected results, sources of error, or why a particular step in an experiment/practical matters.',
  concept: 'Deep conceptual "why" and "what if" questions that test real understanding rather than memorized definitions.',
};

export const doubtsPrompt: PromptDefinition<DoubtsPromptInput, { doubts: GeneratedDoubtItem[] }> = {
  version: '1',
  feature: 'syllabus.doubts',
  systemPrompt: `You generate likely questions a student preparing for exams,
viva, labs, and interviews should be ready for. For each question, also
give expectedAnswerPoints: 3-5 bullet points capturing what a strong
answer must include (not a full written answer — just the checklist a
student can self-grade against).`,
  buildUserPrompt: (input: DoubtsPromptInput) => `Subject context: ${input.subjectContext}
Topics: ${input.topics.join(', ')}
Categories to generate: ${input.categories
    .map((c) => `${c} (${CATEGORY_INSTRUCTIONS[c]})`)
    .join('; ')}
Generate ${input.countPerCategory} questions per category, spread across the given topics.`,
  responseSchema: {
    type: 'object',
    required: ['doubts'],
    properties: {
      doubts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['category', 'question', 'expectedAnswerPoints', 'topic', 'difficulty'],
          properties: {
            category: { type: 'string' },
            question: { type: 'string' },
            expectedAnswerPoints: { type: 'array', items: { type: 'string' } },
            topic: { type: 'string' },
            difficulty: { type: 'string' },
          },
        },
      },
    },
  },
  generation: { temperature: 0.6, maxOutputTokens: 2048 },
};
