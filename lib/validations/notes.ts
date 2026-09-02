import { z } from "zod";

export const noteTypeSchema = z.enum([
  "detailed",
  "short",
  "revision",
  "exam",
  "one_page",
  "chapter",
  "unit",
  "topic",
  "lecture",
  "mindmap",
  "cheat_sheet",
  "formula_sheet",
  "definition_sheet",
  "key_points",
  "concept_map",
  "flow_notes",
  "comparison_table",
  "flashcards",
]);

export const learningModeSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "exam_prep",
  "revision",
  "last_minute",
  "quick_read",
  "deep_study",
  "concept_learning",
  "competitive_exam",
]);

export const outputStyleSchema = z.enum([
  "bullet",
  "paragraph",
  "cornell",
  "outline",
  "mindmap_structure",
  "flashcard",
  "markdown",
  "html",
  "rich_text",
]);

export const lengthHintSchema = z.enum(["very_short", "short", "medium", "long"]);

export const sourceKindSchema = z.enum([
  "pdf",
  "docx",
  "pptx",
  "txt",
  "markdown",
  "image",
  "scanned_pdf",
  "handwritten",
  "url",
  "plain_text",
]);

export const generateNoteRequestSchema = z.object({
  noteType: noteTypeSchema,
  sourceKind: sourceKindSchema,
  sourceText: z.string().min(1, "Source text is required").max(200_000),
  sourceTitle: z.string().max(300).optional(),
  uploadId: z.string().uuid().optional(),
  learningMode: learningModeSchema.optional(),
  outputStyle: outputStyleSchema.optional(),
  focusTopic: z.string().max(300).optional(),
  lengthHint: lengthHintSchema.optional(),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(15).optional(),
});
export type GenerateNoteRequest = z.infer<typeof generateNoteRequestSchema>;

export const listNotesQuerySchema = z.object({
  folderId: z.string().uuid().optional(),
  unfiled: z.coerce.boolean().optional(),
  tag: z.string().max(40).optional(),
  pinnedOnly: z.coerce.boolean().optional(),
  q: z.string().max(200).optional(),
});
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;

export const updateNoteContentSchema = z.object({
  contentMd: z.string().max(500_000),
});

export const updateNoteMetadataSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(15).optional(),
  isPinned: z.boolean().optional(),
});

/** Combined PATCH body for app/api/notes/[id]/route.ts — any subset of content + metadata fields. */
export const patchNoteSchema = z
  .object({
    contentMd: z.string().max(500_000).optional(),
    title: z.string().min(1).max(300).optional(),
    folderId: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().min(1).max(40)).max(15).optional(),
    isPinned: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Provide at least one field to update" });

export const exportNoteQuerySchema = z.object({
  format: z.enum(["markdown", "html", "txt", "json", "csv", "docx", "pdf"]),
});

export const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(80),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #5ff2ff")
    .optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #5ff2ff")
    .optional(),
});
