/**
 * lib/syllabus/prompts/notes.prompt.ts
 *
 * Generates study notes for a single topic in one of the NotesVariant
 * shapes. `mind_map` fills the `mindMap` tree; every other variant fills
 * `content` as markdown. Authored to the AI-Core PromptDefinition contract
 * (this file was referenced by notes.service.ts but never existed).
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { NotesVariant, MindMapNode } from '../models/syllabus.types';

export interface NotesPromptInput {
  topic: string;
  variant: NotesVariant;
  subjectContext: string;
}

export interface NotesPromptOutput {
  content: string;
  mindMap?: MindMapNode;
}

const VARIANT_GUIDANCE: Record<NotesVariant, string> = {
  complete: 'Comprehensive markdown notes: definitions, explanations, worked examples, and key takeaways.',
  short: 'Tight markdown notes: only the core ideas, formulas, and must-know facts.',
  exam: 'Exam-focused markdown: likely questions, high-yield points, common traps, and scoring tips.',
  revision: 'Fast-revision markdown: bulleted recap, formulas, and one-line reminders.',
  one_page: 'A single-page markdown cheat sheet — dense but scannable, no filler.',
  mind_map: 'A hierarchical mind map. Put the tree in `mindMap` (label + nested children) and leave `content` empty.',
};

export const notesPrompt: PromptDefinition<NotesPromptInput, NotesPromptOutput> = {
  version: '1',
  feature: 'syllabus.notes',
  systemPrompt: `You write focused study notes for a specific topic within a course.
Match the requested variant exactly. For every variant except mind_map, return
markdown in \`content\` and omit \`mindMap\`. For mind_map, return the tree in
\`mindMap\` (each node has a short \`label\` and a \`children\` array) and set
\`content\` to an empty string. Be accurate and concrete — prefer real formulas,
definitions, and examples over generic advice.`,
  buildUserPrompt: (input: NotesPromptInput) =>
    `Subject context: ${input.subjectContext}\n` +
    `Topic: ${input.topic}\n` +
    `Variant: ${input.variant}\n\n` +
    `${VARIANT_GUIDANCE[input.variant]}\n\nGenerate the notes now.`,
  responseSchema: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string' },
      mindMap: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          children: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                children: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { label: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  generation: { temperature: 0.5, maxOutputTokens: 3072 },
};
