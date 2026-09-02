/**
 * lib/notes/prompts/exam-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const EXAM_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-exam",
  version: "1.0.0",
  emphasis:
    "Optimize purely for exam performance. Populate examTips and commonMistakes thoroughly " +
    "(these are the most important fields for this note type). Prefer content that is likely " +
    "to be directly tested over background context. Include faqs shaped like likely exam " +
    "questions with model-answer-quality responses.",
  temperature: 0.35,
  maxOutputTokens: 6144,
});
