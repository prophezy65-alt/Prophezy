/**
 * lib/syllabus/services/quiz.service.ts
 */

import { randomUUID } from 'crypto';
import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { quizPrompt } from '../prompts/quiz.prompt';
import type { ExtractedSyllabus, QuestionType, QuizSet } from '../models/syllabus.types';

const DEFAULT_TYPES: QuestionType[] = ['mcq', 'true_false', 'short_answer'];

export async function generateQuiz(
  userId: string,
  syllabus: ExtractedSyllabus,
  topics: string[],
  options?: { questionTypes?: QuestionType[]; totalQuestions?: number },
): Promise<QuizSet> {
  const questionTypes = options?.questionTypes ?? DEFAULT_TYPES;
  const totalQuestions = options?.totalQuestions ?? 10;

  const generated = await runSyllabusPrompt(quizPrompt, {
    topics,
    subjectContext: `${syllabus.subjectName} (${syllabus.courseCode ?? 'no code'})`,
    questionTypes,
    totalQuestions,
  }, { userId });

  const questions = generated.questions.map((q) => ({ id: randomUUID(), ...q }));
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  return {
    syllabusId: syllabus.id,
    topics,
    questions,
    totalMarks,
    generatedAt: new Date().toISOString(),
  };
}
