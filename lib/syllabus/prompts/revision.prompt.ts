/**
 * lib/syllabus/prompts/revision.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { RevisionMode } from '../models/syllabus.types';

export interface RevisionPromptInput {
  mode: RevisionMode;
  subjectContext: string;
  topics: string[];
}

const MODE_INSTRUCTIONS: Record<RevisionMode, string> = {
  last_day:
    'Produce a full last-day revision guide: every topic given, condensed to its highest-yield points, organized so the student can work through the entire list in one focused day.',
  night_before:
    'Produce a calmer, lighter revision pass meant for the night before the exam: confidence-building recap of the most important points only, explicitly lower-volume than a full revision guide, ending with a short reassuring note (not motivational fluff — practical, e.g. "you have already covered the highest-weightage topics").',
  thirty_min:
    'Produce a strict 30-minute revision sheet: only what can realistically be read and absorbed in 30 minutes. Prioritize ruthlessly by exam weightage.',
  five_min:
    'Produce a 5-minute revision sheet: the absolute must-know facts/formulas only, as a short scannable list. No explanations, just the facts.',
  formula_sheet:
    'Produce ONLY a formula/key-fact sheet: every formula, definition, or key numerical fact from these topics, with no prose explanation — just the formula and a 3-5 word label for when to use it.',
};

export const revisionPrompt: PromptDefinition<RevisionPromptInput, { content: string; keyFormulas?: string[] }> = {
  version: '1',
  feature: 'syllabus.revision',
  systemPrompt: `You are an exam revision specialist. Match the requested mode's
scope EXACTLY — a "five_min" sheet must genuinely be readable in 5 minutes,
not a disguised full summary. Ground everything in the specific topics
given, never generic study advice.`,
  buildUserPrompt: (input: RevisionPromptInput) => `Subject context: ${input.subjectContext}
Revision mode: ${input.mode}
Instruction: ${MODE_INSTRUCTIONS[input.mode]}
Topics to cover: ${input.topics.join(', ')}

Generate the revision content now. If mode is "formula_sheet", also
populate keyFormulas as a flat list of "formula — when to use it" strings.`,
  responseSchema: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string' },
      keyFormulas: { type: 'array', items: { type: 'string' } },
    },
  },
  generation: { temperature: 0.5, maxOutputTokens: 3072 },
};
