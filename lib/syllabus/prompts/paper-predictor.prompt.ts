/**
 * lib/syllabus/prompts/paper-predictor.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type {
  ExtractedSyllabus,
  MarksDistributionItem,
  PredictedQuestion,
  PredictedTopic,
} from '../models/syllabus.types';

export interface PaperPredictorInput {
  syllabus: ExtractedSyllabus;
  previousYearQuestionsText?: string;
  /** Total number of expectedQuestions to generate, spread across the three probability bands below. Defaults to a sensible count in buildUserPrompt if omitted. */
  questionCount?: number;
}

const DEFAULT_QUESTION_COUNT = 12;

export const paperPredictorPrompt: PromptDefinition<PaperPredictorInput, {
  mostImportantTopics: PredictedTopic[];
  expectedQuestions: PredictedQuestion[];
  overallMarksDistributionForecast: MarksDistributionItem[];
}> = {
  version: '2',
  feature: 'syllabus.paper-predictor',
  systemPrompt: `You are an exam-pattern analyst. Given a syllabus (with its marks
distribution) and, if provided, raw text of previous years' question
papers, predict what's most likely to appear on the next exam:

- mostImportantTopics: ranked topics with a probabilityScore (0-100,
  calibrated — not everything can be 90+), predictedMarks, and a concrete
  reason (e.g. "appeared in 4 of the last 5 papers", "carries the highest
  unit weightage", "foundational for two other heavily-tested units").
- expectedQuestions: specific likely questions (not just topics), each with
  its own probabilityScore, expectedMarks, and question type. Generate
  EXACTLY the requested total count, and spread their probabilityScore
  values across three bands so the result is genuinely tiered rather than
  clustered at one level:
    - High probability (score 70-95): roughly 40% of the requested count —
      the questions you're most confident about.
    - Medium probability (score 40-69): roughly 35% of the requested count.
    - Low probability (score 5-39): roughly the remaining 25% — plausible
      but less certain questions, still worth the student's attention as a
      "just in case" list, not filler.
  Round each band's count sensibly so they sum to exactly the requested
  total (e.g. for 12 questions: ~5 high, ~4 medium, ~3 low).
- overallMarksDistributionForecast: your best estimate of how marks will
  split across components, informed by the syllabus's stated distribution
  and any pattern in the previous papers given.

If no previous-year question text is supplied, base predictions purely on
syllabus structure (marks weightage, unit emphasis, learning outcomes) and
say so implicitly by keeping probability scores moderate rather than
overconfident.`,
  buildUserPrompt: (input: PaperPredictorInput) => `Subject: ${input.syllabus.subjectName}
Units: ${JSON.stringify(input.syllabus.units, null, 2)}
Marks distribution: ${JSON.stringify(input.syllabus.marksDistribution, null, 2)}

${
  input.previousYearQuestionsText
    ? `Previous year question papers (raw text):\n${input.previousYearQuestionsText}`
    : 'No previous year question papers were supplied — base predictions on syllabus structure alone.'
}

Total expectedQuestions to generate: EXACTLY ${input.questionCount && input.questionCount > 0 ? input.questionCount : DEFAULT_QUESTION_COUNT} — distributed across the High/Medium/Low probability bands as instructed above.

Generate the prediction now.`,
  responseSchema: {
    type: 'object',
    required: ['mostImportantTopics', 'expectedQuestions', 'overallMarksDistributionForecast'],
    properties: {
      mostImportantTopics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            probabilityScore: { type: 'number' },
            predictedMarks: { type: 'number' },
            reason: { type: 'string' },
          },
        },
      },
      expectedQuestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            topic: { type: 'string' },
            probabilityScore: { type: 'number' },
            expectedMarks: { type: 'number' },
            type: { type: 'string' },
          },
        },
      },
      overallMarksDistributionForecast: {
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
    },
  },
  generation: { temperature: 0.5, maxOutputTokens: 8192 },
};
