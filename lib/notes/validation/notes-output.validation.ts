/**
 * lib/notes/validation/notes-output.validation.ts
 *
 * runAI() already enforces Gemini's responseSchema and safeJsonParse's
 * repair logic, so malformed JSON never reaches here. This layer catches a
 * different failure mode: syntactically valid JSON that's semantically
 * empty or degenerate (e.g. a "detailed" note with zero topics because the
 * source text was too short/garbled for the model to extract anything) —
 * which the caller needs to know about to show a useful error instead of a
 * blank notes page.
 */

import { validateShape, type Shape } from "../../ai/utils/validator";
import { AIValidationError } from "../../ai/utils/errors";
import type { NoteGenerationOutput, NotesOutput, MindMapOutput, FlashcardsOutput } from "../models/types";

const NOTES_OUTPUT_SHAPE: Shape = {
  title: { type: "string", required: true, minLength: 1 },
  overview: { type: "string", required: true },
  topics: { type: "array", required: true },
  keyPoints: { type: "array", required: true },
  definitions: { type: "array", required: true },
  formulas: { type: "array", required: true },
  examples: { type: "array", required: true },
  mnemonics: { type: "array", required: true },
  faqs: { type: "array", required: true },
  examTips: { type: "array", required: true },
  commonMistakes: { type: "array", required: true },
  difficulty: { type: "string", required: true },
  estimatedStudyMinutes: { type: "number", required: true },
};

const MINDMAP_SHAPE: Shape = {
  title: { type: "string", required: true, minLength: 1 },
  nodes: { type: "array", required: true, minItems: 1 },
  edges: { type: "array", required: true },
  mermaid: { type: "string", required: true, minLength: 1 },
};

const FLASHCARDS_SHAPE: Shape = {
  title: { type: "string", required: true, minLength: 1 },
  cards: { type: "array", required: true, minItems: 1 },
};

/**
 * Throws AIValidationError if the output is structurally sound but
 * substantively empty (e.g. a prose note with no topics AND no keyPoints
 * AND no definitions — nothing worth showing the student).
 */
export function assertNotesOutputUsable(noteType: string, output: NoteGenerationOutput): void {
  if (noteType === "mindmap") {
    validateShape(output, MINDMAP_SHAPE);
    return;
  }

  if (noteType === "flashcards") {
    validateShape(output, FLASHCARDS_SHAPE);
    return;
  }

  validateShape(output, NOTES_OUTPUT_SHAPE);

  const notes = output as NotesOutput;
  const hasAnyContent =
    notes.topics.length > 0 ||
    notes.keyPoints.length > 0 ||
    notes.definitions.length > 0 ||
    notes.formulas.length > 0;

  if (!hasAnyContent) {
    throw new AIValidationError(
      "Generated notes contain no topics, keyPoints, definitions, or formulas — the source " +
        "content was likely too short, empty, or unreadable to extract study material from.",
      { noteType, output }
    );
  }
}

export type { NotesOutput, MindMapOutput, FlashcardsOutput };
