/**
 * lib/syllabus/prompts/pyq-mapper.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { ExtractedSyllabus, PyqMappingEntry } from '../models/syllabus.types';

export interface PyqMapperInput {
  syllabus: ExtractedSyllabus;
  previousYearQuestionsText: string;
}

export const pyqMapperPrompt: PromptDefinition<PyqMapperInput, { entries: PyqMappingEntry[] }> = {
  version: '1',
  feature: 'syllabus.pyq-mapper',
  systemPrompt: `You are matching a syllabus's topics against a set of previous
year exam questions. For EVERY topic in the syllabus (units + chapters),
determine:
- matchedQuestions: the actual previous-year questions (quoted/paraphrased
  briefly) that test this topic, if any
- coverageStatus: "covered" if multiple past questions clearly test it,
  "partially_covered" if it's touched on tangentially or only once,
  "not_covered" if no past question addresses it at all
- notes: a short explanation of your judgment

Do not mark a topic as "covered" just because it sounds similar to a
question — the question must genuinely test that specific topic's
content.`,
  buildUserPrompt: (input: PyqMapperInput) => `Syllabus topics (units + chapters):
${JSON.stringify(
  [...input.syllabus.units.map((u) => u.title), ...input.syllabus.chapters.map((c) => c.title)],
  null,
  2,
)}

Previous year questions (raw text):
${input.previousYearQuestionsText}

Produce the full mapping now, one entry per syllabus topic.`,
  responseSchema: {
    type: 'object',
    required: ['entries'],
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          required: ['syllabusTopic', 'matchedQuestions', 'coverageStatus', 'notes'],
          properties: {
            syllabusTopic: { type: 'string' },
            matchedQuestions: { type: 'array', items: { type: 'string' } },
            coverageStatus: { type: 'string', enum: ['covered', 'partially_covered', 'not_covered'] },
            notes: { type: 'string' },
          },
        },
      },
    },
  },
  generation: { temperature: 0.3, maxOutputTokens: 4096 },
};
