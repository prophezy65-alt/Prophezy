/**
 * lib/ai/services/notes.service.ts
 */
import { runStructured } from "./_run-structured";
import { NOTES_PROMPT, type NotesInput, type NotesOutput } from "../prompts/notes";

export function generateNotes(
  userId: string,
  input: NotesInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<NotesOutput> {
  return runStructured(NOTES_PROMPT, { userId, input, ...opts });
}
