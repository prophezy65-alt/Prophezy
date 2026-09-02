/**
 * lib/syllabus/prompts/quiz.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { QuestionType, TopicDifficulty } from '../models/syllabus.types';

export interface QuizPromptInput {
  topics: string[];
  subjectContext: string;
  questionTypes: QuestionType[];
  totalQuestions: number;
}

export interface GeneratedQuizQuestion {
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  marks: number;
  difficulty: TopicDifficulty;
  topic: string;
}

export const quizPrompt: PromptDefinition<QuizPromptInput, { questions: GeneratedQuizQuestion[] }> = {
  version: '1',
  feature: 'syllabus.quiz',
  systemPrompt: `You are an expert exam-question setter. Generate questions strictly
of the requested types:
- mcq: exactly 4 options, one correct
- true_false: options must be exactly ["True", "False"]
- fill_blank: question contains a blank marked "_____"
- short_answer: expects a 2-4 sentence answer
- long_answer: expects a multi-paragraph/structured answer
- case_based: presents a short scenario, then asks a question about it
- programming: asks the student to write or trace through code relevant to
  the subject (only generate these if the subject is technical/CS-adjacent)
- numerical: requires a calculation; correctAnswer must be the final numeric
  result with units if applicable, and explanation must show the working

Every question needs a correctAnswer and a genuinely useful explanation
(not just "because it's correct"). Assign marks proportional to difficulty
and question type (numerical/long_answer typically worth more than mcq/
true_false). Distribute questions across the given topics rather than
concentrating on one.`,
  buildUserPrompt: (input: QuizPromptInput) => `Subject context: ${input.subjectContext}
Topics to cover: ${input.topics.join(', ')}
Question types to include: ${input.questionTypes.join(', ')}
Total questions to generate: ${input.totalQuestions}

Generate the quiz now, distributing questions across topics and the
requested types.`,
  responseSchema: {
    type: 'object',
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'question', 'correctAnswer', 'explanation', 'marks', 'difficulty', 'topic'],
          properties: {
            type: { type: 'string' },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correctAnswer: { type: 'string' },
            explanation: { type: 'string' },
            marks: { type: 'number' },
            difficulty: { type: 'string' },
            topic: { type: 'string' },
          },
        },
      },
    },
  },
  generation: { temperature: 0.6, maxOutputTokens: 4096 },
};
