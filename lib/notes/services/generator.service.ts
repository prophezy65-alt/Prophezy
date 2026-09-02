/**
 * lib/notes/services/generator.service.ts
 *
 * Single dispatch point mapping a NoteType -> its PromptDefinition -> a
 * runStructured() call. This is the only file in lib/notes/ that knows
 * about every individual prompt file; every other service (notes.service.ts,
 * revision.service.ts, etc.) calls generateNotes() rather than importing
 * prompts directly, so adding a new note type later means touching exactly
 * two files: a new prompts/<x>.prompt.ts, and one new case here.
 */

import { runStructured } from "../../ai/services/_run-structured";
import type { NotesPromptInput } from "../prompts/_factory";
import { DETAILED_NOTES_PROMPT } from "../prompts/detailed-notes.prompt";
import { SHORT_NOTES_PROMPT } from "../prompts/short-notes.prompt";
import { REVISION_NOTES_PROMPT } from "../prompts/revision-notes.prompt";
import { EXAM_NOTES_PROMPT } from "../prompts/exam-notes.prompt";
import { ONE_PAGE_NOTES_PROMPT } from "../prompts/one-page-notes.prompt";
import { CHAPTER_NOTES_PROMPT } from "../prompts/chapter-notes.prompt";
import { UNIT_NOTES_PROMPT } from "../prompts/unit-notes.prompt";
import { TOPIC_NOTES_PROMPT } from "../prompts/topic-notes.prompt";
import { LECTURE_NOTES_PROMPT } from "../prompts/lecture-notes.prompt";
import { CHEAT_SHEET_PROMPT } from "../prompts/cheat-sheet.prompt";
import { FORMULA_SHEET_PROMPT } from "../prompts/formula-sheet.prompt";
import { DEFINITION_SHEET_PROMPT } from "../prompts/definition-sheet.prompt";
import { KEY_POINTS_PROMPT } from "../prompts/key-points.prompt";
import { CONCEPT_MAP_NOTES_PROMPT } from "../prompts/concept-map-notes.prompt";
import { FLOW_NOTES_PROMPT } from "../prompts/flow-notes.prompt";
import { COMPARISON_TABLE_NOTES_PROMPT } from "../prompts/comparison-table-notes.prompt";
import { MINDMAP_PROMPT } from "../prompts/mindmap.prompt";
import { NOTES_FLASHCARDS_PROMPT } from "../prompts/flashcards.prompt";
import type {
  NoteGenerationOutput,
  NotesGenerationRequest,
  NoteType,
} from "../models/types";
import { AIValidationError } from "../../ai/utils/errors";

/** Every prose note type shares one PromptDefinition shape; only these three are structurally different. */
const STRUCTURED_PROMPTS = {
  detailed: DETAILED_NOTES_PROMPT,
  short: SHORT_NOTES_PROMPT,
  revision: REVISION_NOTES_PROMPT,
  exam: EXAM_NOTES_PROMPT,
  one_page: ONE_PAGE_NOTES_PROMPT,
  chapter: CHAPTER_NOTES_PROMPT,
  unit: UNIT_NOTES_PROMPT,
  topic: TOPIC_NOTES_PROMPT,
  lecture: LECTURE_NOTES_PROMPT,
  cheat_sheet: CHEAT_SHEET_PROMPT,
  formula_sheet: FORMULA_SHEET_PROMPT,
  definition_sheet: DEFINITION_SHEET_PROMPT,
  key_points: KEY_POINTS_PROMPT,
  concept_map: CONCEPT_MAP_NOTES_PROMPT,
  flow_notes: FLOW_NOTES_PROMPT,
  comparison_table: COMPARISON_TABLE_NOTES_PROMPT,
} as const satisfies Partial<Record<NoteType, unknown>>;

type ProseNoteType = keyof typeof STRUCTURED_PROMPTS;

function isProseNoteType(noteType: NoteType): noteType is ProseNoteType {
  return Object.prototype.hasOwnProperty.call(STRUCTURED_PROMPTS, noteType);
}

function toPromptInput(request: NotesGenerationRequest): NotesPromptInput {
  return {
    sourceText: request.source.text,
    sourceTitle: request.source.title,
    focusTopic: request.focusTopic,
    learningMode: request.learningMode,
    outputStyle: request.outputStyle,
    lengthHint: request.lengthHint,
  };
}

/**
 * Generates notes for any supported NoteType. Returns NotesOutput for the
 * fourteen prose types, MindMapOutput for "mindmap", or FlashcardsOutput
 * for "flashcards" — callers should narrow on `request.noteType` if they
 * need the concrete shape (generator.service.ts itself stays type-safe via
 * the overloads below; the underlying call is identical either way).
 */
export async function generateNotes(
  request: NotesGenerationRequest
): Promise<NoteGenerationOutput> {
  const input = toPromptInput(request);
  const runOpts = {
    userId: request.userId,
    input,
    forceRefresh: request.forceRefresh,
    requestId: request.requestId,
  };

  if (request.noteType === "mindmap") {
    return runStructured(MINDMAP_PROMPT, runOpts);
  }

  if (request.noteType === "flashcards") {
    return runStructured(NOTES_FLASHCARDS_PROMPT, runOpts);
  }

  if (isProseNoteType(request.noteType)) {
    const prompt = STRUCTURED_PROMPTS[request.noteType];
    return runStructured(prompt, runOpts);
  }

  // Exhaustiveness guard — throws only if NoteType grows a case this file
  // hasn't been updated for yet, rather than silently mis-generating.
  throw new AIValidationError(`Unsupported note type: ${request.noteType}`, {
    noteType: request.noteType,
  });
}
