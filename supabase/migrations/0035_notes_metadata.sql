-- ============================================================================
-- PROPHEZY — 0035_notes_metadata.sql
-- Purpose : Additive metadata columns on `notes` (0007). The real table only
--           ever stored `content_md` + `word_count` — with 18 distinct note
--           types this module generates (detailed/short/revision/exam/
--           mindmap/flashcards/...), a note list has no way to tell them
--           apart or show what learning mode/output style produced them
--           without this. Nullable / safely defaulted — every existing row
--           (if any) remains valid.
-- Depends : 0007_notes.sql
-- ============================================================================

alter table public.notes
  add column if not exists note_type     text,
  add column if not exists learning_mode text,
  add column if not exists output_style  text;

comment on column public.notes.note_type is
  'One of lib/notes/models/types.ts''s NoteType union (detailed, short, revision, exam, mindmap, flashcards, ...). Free text, not an enum, since this module''s type list is expected to grow without a migration each time — validated at the application layer (validation/notes-output.validation.ts) instead.';

create index if not exists notes_note_type_idx on public.notes (note_type);
