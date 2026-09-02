/**
 * lib/notes/services/notes.service.ts
 *
 * The main entry point for the Notes Intelligence Engine. API routes call
 * this, not generator.service.ts directly, so the full lifecycle (generate
 * -> validate -> format -> persist) always happens together and stays
 * consistent across every note type and every caller.
 *
 * Updated to persist against the REAL applied schema (generations + notes,
 * content_md — see notes.repository.supabase.ts's header comment) instead
 * of the never-applied proposed jsonb schema. `defaultNotesRepository`
 * (in-memory) remains the default for callers that don't inject one (tests,
 * local dev without a DB); app/api/notes/* routes explicitly inject
 * `SupabaseNotesRepository` for real persistence.
 *
 * Reuse note: parsing/OCR of raw uploads (PDF/DOCX/PPTX/images/scanned
 * PDFs/handwriting) happens in app/api/notes/upload/route.ts, which reuses
 * the existing Document Intelligence Engine's parser (lib/document/parser)
 * per the "reuse OCR, reuse parsers" rule, then hands this service a plain
 * SourceDocument with `text` already extracted — this file only ever deals
 * with text in.
 */

import { randomUUID } from "node:crypto";
import { generateNotes } from "./generator.service";
import { assertNotesOutputUsable } from "../validation/notes-output.validation";
import { toHtml, toMarkdown, toPlainText } from "./formatter.service";
import { summaryFromOutput } from "./summary.service";
import {
  defaultNotesRepository,
  type NotesRepository,
  type ListNotesOptions,
} from "./notes.repository";
import type {
  Notes,
  NotesGenerationRequest,
  NoteGenerationOutput,
  NoteVersion,
} from "../models/types";
import { spendCreditsForFeature, getFeatureCreditCost } from "@/lib/credits";
import { CREDIT_FEATURES } from "@/lib/credits/feature-keys";

/** Central credit system feature key for every AI note-generation call in
 * this file (generateAndSaveNotes, regenerateNotes, regenerateSummary all
 * ultimately call generateNotes() -> one real Gemini call each). Cost is
 * NOT hardcoded here — it's looked up from public.feature_credit_costs
 * (see supabase/migrations/20260815090000_credit_system_phase4_final_economy.sql)
 * on every call, so changing the price is a data update, not a deploy.
 * Renamed from the Phase 2B/3 provisional "notes" key to the Phase 4
 * canonical AI_NOTE_GENERATION key — this is the first and only place
 * that key was ever referenced, so no migration of historical
 * credit_transactions rows was needed. */
const CREDIT_FEATURE = CREDIT_FEATURES.AI_NOTE_GENERATION;

export interface GenerateAndSaveResult {
  notes: Notes;
  output: NoteGenerationOutput;
  markdown: string;
  html: string;
  plainText: string;
}

export interface NotesServiceOptions {
  repository?: NotesRepository;
}

function outputTitle(output: NoteGenerationOutput): string {
  const raw = "title" in output ? output.title?.trim() : "";
  return raw || "Untitled notes";
}

function wordCount(markdown: string): number {
  const trimmed = markdown.trim();
  return trimmed.length ? trimmed.split(/\s+/).length : 0;
}

/**
 * Generates notes for a request, validates the result is substantively
 * usable, renders every export-ready text format up front (cheap — pure
 * string transforms, no extra AI calls), and persists the record.
 *
 * `opts.repository` defaults to the shared in-memory repository; pass a
 * `SupabaseNotesRepository` for real persistence (every app/api/notes/*
 * route does this).
 */
export async function generateAndSaveNotes(
  request: NotesGenerationRequest,
  opts: NotesServiceOptions = {}
): Promise<GenerateAndSaveResult> {
  const repository = opts.repository ?? defaultNotesRepository;

  const cost = await getFeatureCreditCost(CREDIT_FEATURE);
  if (!cost) {
    throw new Error(
      `AI note generation is temporarily unavailable (no active credit cost configured for "${CREDIT_FEATURE}").`
    );
  }

  // Credits are deducted BEFORE the AI call and automatically refunded if
  // generateNotes() or the usability check throws — see
  // lib/credits/credit.service.ts's spendCreditsForFeature doc comment for
  // why refund-on-failure was chosen over reserve/finalize. Validation is
  // deliberately INSIDE this callback (not after it returns) so a note
  // that generates but comes back unusable also gets refunded, not just a
  // hard API failure.
  const output: NoteGenerationOutput = await spendCreditsForFeature(
    request.userId,
    cost.creditCost,
    CREDIT_FEATURE,
    async () => {
      const result = await generateNotes(request);
      assertNotesOutputUsable(request.noteType, result);
      return result;
    },
    `AI note generation (${request.noteType})`
  );

  const markdown = toMarkdown(output);
  const now = new Date().toISOString();

  const notes: Notes = {
    id: randomUUID(),
    userId: request.userId,
    generationId: request.requestId ?? randomUUID(),
    title: outputTitle(output),
    noteType: request.noteType,
    learningMode: request.learningMode,
    outputStyle: request.outputStyle,
    folderId: request.folderId ?? null,
    tags: request.tags ?? [],
    isPinned: false,
    status: "ready",
    contentMd: markdown,
    summary: summaryFromOutput(output),
    wordCount: wordCount(markdown),
    createdAt: now,
    updatedAt: now,
  };

  const saved = await repository.save(notes);

  return {
    notes: saved,
    output,
    markdown,
    html: toHtml(output),
    plainText: toPlainText(output),
  };
}

/** Fetches a previously generated note. Returns null if not found or not owned by userId. */
export async function getNotes(
  notesId: string,
  userId: string,
  opts: NotesServiceOptions = {}
): Promise<Notes | null> {
  const repository = opts.repository ?? defaultNotesRepository;
  const notes = await repository.getById(notesId);
  console.log(
    `getNotes(${notesId}): repository returned`,
    notes
      ? { id: notes.id, ownerId: notes.userId, requestingUserId: userId, contentMdLength: notes.contentMd?.length ?? 0 }
      : null
  );
  if (!notes || notes.userId !== userId) return null;
  return notes;
}

/** Lists a user's notes, most recently updated first, optionally filtered by folder/tag/pin/title search. */
export async function listNotesForUser(
  userId: string,
  options: ListNotesOptions = {},
  opts: NotesServiceOptions = {}
): Promise<Notes[]> {
  const repository = opts.repository ?? defaultNotesRepository;
  return repository.listByUser(userId, options);
}

/** Deletes a note. No-op (not an error) if it doesn't exist or isn't owned by userId. */
export async function deleteNotes(
  notesId: string,
  userId: string,
  opts: NotesServiceOptions = {}
): Promise<void> {
  const repository = opts.repository ?? defaultNotesRepository;
  const existing = await repository.getById(notesId);
  if (!existing || existing.userId !== userId) return;
  await repository.deleteById(notesId);
}

/**
 * Auto-save / manual edit of a note's markdown body. Word count is
 * recomputed by the repository from the new content. Returns null if the
 * note doesn't exist or isn't owned by userId (caller should treat this as
 * a 404, not throw a generic error into the editor's auto-save loop).
 */
export async function updateNoteContent(
  notesId: string,
  userId: string,
  contentMd: string,
  opts: NotesServiceOptions = {}
): Promise<Notes | null> {
  const repository = opts.repository ?? defaultNotesRepository;
  const existing = await repository.getById(notesId);
  if (!existing || existing.userId !== userId) return null;
  return repository.update(notesId, { contentMd });
}

/** Updates note metadata (title/folder/tags/pin) without touching content. */
export async function updateNoteMetadata(
  notesId: string,
  userId: string,
  patch: Partial<Pick<Notes, "title" | "folderId" | "tags" | "isPinned">>,
  opts: NotesServiceOptions = {}
): Promise<Notes | null> {
  const repository = opts.repository ?? defaultNotesRepository;
  const existing = await repository.getById(notesId);
  if (!existing || existing.userId !== userId) return null;
  return repository.update(notesId, patch);
}

/** Regenerates a note's summary from its current (possibly hand-edited) content — one AI call, via the "short" note type. */
export async function regenerateSummary(
  notesId: string,
  userId: string,
  opts: NotesServiceOptions = {}
): Promise<Notes | null> {
  const repository = opts.repository ?? defaultNotesRepository;
  const existing = await repository.getById(notesId);
  if (!existing || existing.userId !== userId) return null;

  const cost = await getFeatureCreditCost(CREDIT_FEATURE);
  if (!cost) {
    throw new Error(
      `AI note generation is temporarily unavailable (no active credit cost configured for "${CREDIT_FEATURE}").`
    );
  }

  const output = await spendCreditsForFeature(
    userId,
    cost.creditCost,
    CREDIT_FEATURE,
    () =>
      generateNotes({
        userId,
        noteType: "short",
        source: { kind: "plain_text", text: existing.contentMd },
      }),
    "AI note summary regeneration"
  );

  const summary = summaryFromOutput(output);
  return repository.update(notesId, { summary });
}

/**
 * Regenerates an existing note with the same request parameters but
 * forceRefresh=true (bypasses the AI Core response cache), overwriting the
 * stored content. Useful for a "Regenerate" button in the UI.
 */
export async function regenerateNotes(
  notesId: string,
  request: NotesGenerationRequest,
  opts: NotesServiceOptions = {}
): Promise<GenerateAndSaveResult> {
  const repository = opts.repository ?? defaultNotesRepository;
  const existing = await repository.getById(notesId);
  if (!existing || existing.userId !== request.userId) {
    throw new Error("Notes not found for this user.");
  }

  const cost = await getFeatureCreditCost(CREDIT_FEATURE);
  if (!cost) {
    throw new Error(
      `AI note generation is temporarily unavailable (no active credit cost configured for "${CREDIT_FEATURE}").`
    );
  }

  const output = await spendCreditsForFeature(
    request.userId,
    cost.creditCost,
    CREDIT_FEATURE,
    async () => {
      const result = await generateNotes({ ...request, forceRefresh: true });
      assertNotesOutputUsable(request.noteType, result);
      return result;
    },
    `AI note regeneration (${request.noteType})`
  );

  const markdown = toMarkdown(output);
  const updated = await repository.update(notesId, {
    title: outputTitle(output),
    contentMd: markdown,
    summary: summaryFromOutput(output),
  });

  return {
    notes: updated,
    output,
    markdown,
    html: toHtml(output),
    plainText: toPlainText(output),
  };
}

/** Lists a note's version history, most recent first. Returns an empty array (not an error) if the note doesn't exist or isn't owned by userId. */
export async function listNoteVersions(
  notesId: string,
  userId: string,
  opts: NotesServiceOptions = {}
): Promise<NoteVersion[]> {
  const repository = opts.repository ?? defaultNotesRepository;
  const existing = await repository.getById(notesId);
  if (!existing || existing.userId !== userId) return [];
  return repository.listVersions(notesId);
}

/**
 * Restores a note's content to a prior version. The current content is
 * snapshotted as a new version first, so this is never destructive — it's
 * always possible to undo a restore the same way. Returns null if the note
 * doesn't exist or isn't owned by userId.
 */
export async function restoreNoteVersion(
  notesId: string,
  userId: string,
  versionId: string,
  opts: NotesServiceOptions = {}
): Promise<Notes | null> {
  const repository = opts.repository ?? defaultNotesRepository;
  const existing = await repository.getById(notesId);
  if (!existing || existing.userId !== userId) return null;
  return repository.restoreVersion(notesId, versionId);
}
