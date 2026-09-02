/**
 * lib/interview/generator/question-generator.service.ts
 */
import { runStructured } from "../../ai/services/_run-structured";
import { buildQuestionGenPrompt, type QuestionGenInput, type QuestionGenOutput } from "../prompts/generation";
import type { InterviewType } from "../models/interview.model";

export interface GenerateQuestionsParams extends QuestionGenInput {
  interviewType: InterviewType;
}

export function generateInterviewQuestions(
  userId: string,
  params: GenerateQuestionsParams,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<QuestionGenOutput> {
  const { interviewType, ...input } = params;
  const prompt = buildQuestionGenPrompt(interviewType);
  return runStructured(prompt, { userId, input, ...opts });
}
