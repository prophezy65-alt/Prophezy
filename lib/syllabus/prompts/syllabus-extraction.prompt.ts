/**
 * lib/syllabus/prompts/syllabus-extraction.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { ExtractedSyllabus } from '../models/syllabus.types';

export interface SyllabusExtractionInput {
  rawText: string;
  sourceFormat: string;
}

export const syllabusExtractionPrompt: PromptDefinition<SyllabusExtractionInput, 
  Omit<ExtractedSyllabus, 'id' | 'extractedAt' | 'sourceFormat'>
> = {
  version: '1',
  feature: 'syllabus.extraction',
  systemPrompt: `You are an expert academic syllabus parser for Indian and international
university courses. You will be given raw OCR'd or extracted text from a
syllabus document. Extract EVERY piece of structured information present —
do not summarize, do not skip sections, and do not invent information that
is not in the text. If a field genuinely is not present in the source,
omit it or return an empty array/undefined for it rather than guessing.

Extract:
- subjectName, courseCode, university, semester, credits
- units (unitNumber, title, topics[], hours, weightagePercent — as given)
- chapters (chapterNumber, title, topics[])
- practicals and labWork (title, description, labHours)
- marksDistribution (component, marks, weightagePercent)
- references (title, author, edition, type: textbook/reference/online/other)
- learningOutcomes (code like "CO1" if present, description)
- extractionWarnings: list anything ambiguous, illegible, or that you had to
  infer rather than read directly (e.g. "Unit 4 hours not specified in source")

Preserve the original ordering of units/chapters as they appear in the
document. Numbers (unitNumber, chapterNumber) should reflect the source
document's own numbering, not be renumbered.`,
  buildUserPrompt: (input: SyllabusExtractionInput) => `Source format: ${input.sourceFormat}

--- BEGIN SYLLABUS TEXT ---
${input.rawText}
--- END SYLLABUS TEXT ---

Extract the full structured syllabus as specified.`,
  responseSchema: {
    type: 'object',
    required: ['subjectName', 'units', 'chapters', 'practicals', 'labWork', 'marksDistribution', 'references', 'learningOutcomes', 'extractionWarnings'],
    properties: {
      subjectName: { type: 'string' },
      courseCode: { type: 'string' },
      university: { type: 'string' },
      semester: { type: 'string' },
      credits: { type: 'number' },
      units: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            unitNumber: { type: 'number' },
            title: { type: 'string' },
            topics: { type: 'array', items: { type: 'string' } },
            hours: { type: 'number' },
            weightagePercent: { type: 'number' },
          },
        },
      },
      chapters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            chapterNumber: { type: 'number' },
            title: { type: 'string' },
            topics: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      practicals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            labHours: { type: 'number' },
          },
        },
      },
      labWork: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            labHours: { type: 'number' },
          },
        },
      },
      marksDistribution: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            component: { type: 'string' },
            marks: { type: 'number' },
            weightagePercent: { type: 'number' },
          },
        },
      },
      references: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            author: { type: 'string' },
            edition: { type: 'string' },
            type: { type: 'string', enum: ['textbook', 'reference', 'online', 'other'] },
          },
        },
      },
      learningOutcomes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      extractionWarnings: { type: 'array', items: { type: 'string' } },
    },
  },
  // Full syllabi (many units/chapters/references/outcomes) routinely need
  // more than the old 8192-token cap, which was truncating Gemini's JSON
  // mid-object and causing "Model did not return valid JSON" 500s. The
  // model's context window comfortably supports a much higher ceiling.
  generation: { temperature: 0.2, maxOutputTokens: 32768 },
};
