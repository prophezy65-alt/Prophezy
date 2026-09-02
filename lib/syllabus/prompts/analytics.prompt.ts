/**
 * lib/syllabus/prompts/analytics.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { ChapterAnalyticsEntry, ExtractedSyllabus } from '../models/syllabus.types';

export interface AnalyticsPromptInput {
  syllabus: ExtractedSyllabus;
  previousYearQuestionsText?: string;
}

export const analyticsPrompt: PromptDefinition<AnalyticsPromptInput, { entries: ChapterAnalyticsEntry[] }> = {
  version: '1',
  feature: 'syllabus.analytics',
  systemPrompt: `You are analyzing a syllabus's chapters/units to score them on
five independent dimensions (each 0-100, and NOT all correlated — a
chapter can be short but hard, or long but low-yield):

- hardnessScore: conceptual difficulty for a typical student
- lengthScore: relative content volume compared to the other chapters
- importanceScore: how foundational/prerequisite this chapter is for the
  rest of the course
- scoringPotential: how easy it is to score well on this chapter specifically
  (straightforward, formula-driven chapters score higher here even if hard)
- frequencyAskedScore: how often this kind of chapter tends to be
  emphasized in exams — use the previous year questions if given, otherwise
  reason from the syllabus's own marks weightage

Score every chapter/unit given. Be genuinely differentiated — do not give
most chapters the same score band.`,
  buildUserPrompt: (input: AnalyticsPromptInput) => `Subject: ${input.syllabus.subjectName}
Chapters/Units:
${JSON.stringify(
  [
    ...input.syllabus.chapters.map((c) => ({ name: c.title, topics: c.topics })),
    ...input.syllabus.units.map((u) => ({ name: u.title, topics: u.topics })),
  ],
  null,
  2,
)}
Marks distribution: ${JSON.stringify(input.syllabus.marksDistribution, null, 2)}
${
  input.previousYearQuestionsText
    ? `Previous year questions:\n${input.previousYearQuestionsText}`
    : 'No previous year questions supplied.'
}

Score every chapter/unit now.`,
  responseSchema: {
    type: 'object',
    required: ['entries'],
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          required: [
            'chapterOrUnit',
            'hardnessScore',
            'lengthScore',
            'importanceScore',
            'scoringPotential',
            'frequencyAskedScore',
          ],
          properties: {
            chapterOrUnit: { type: 'string' },
            hardnessScore: { type: 'number' },
            lengthScore: { type: 'number' },
            importanceScore: { type: 'number' },
            scoringPotential: { type: 'number' },
            frequencyAskedScore: { type: 'number' },
          },
        },
      },
    },
  },
  generation: { temperature: 0.4, maxOutputTokens: 2048 },
};
