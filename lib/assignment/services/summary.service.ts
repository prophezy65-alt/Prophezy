// lib/assignment/services/summary.service.ts
import type { RevisionNote, FollowUpPracticeSet } from "../models/types";
import { revisionNotesPrompt } from "../prompts/revision-notes";
import { practiceQuestionsPrompt } from "../prompts/practice-questions";
import { runAssignmentPrompt } from "../providers/ai-engine.provider";

export interface GenerateRevisionNotesOptions {
  userId: string;
}

export async function generateRevisionNotes(
  sourceText: string,
  options: GenerateRevisionNotesOptions
): Promise<RevisionNote[]> {
  if (sourceText.trim().length === 0) return [];

  const result = await runAssignmentPrompt(
    revisionNotesPrompt,
    { sourceText },
    { userId: options.userId }
  );

  return result.notes.map((n) => ({ heading: n.heading, bulletPoints: n.bulletPoints }));
}

export interface GeneratePracticeQuestionsOptions {
  userId: string;
}

export async function generatePracticeQuestions(
  topic: string,
  context: string,
  options: GeneratePracticeQuestionsOptions
): Promise<FollowUpPracticeSet> {
  const result = await runAssignmentPrompt(
    practiceQuestionsPrompt,
    { topic, context },
    { userId: options.userId }
  );

  return {
    questions: result.followUpQuestions,
    vivaQuestions: result.vivaQuestions,
    interviewQuestions: result.interviewQuestions,
  };
}
