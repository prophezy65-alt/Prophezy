-- ============================================================================
-- PROPHEZY — 0007_notes.sql
-- Purpose : `generations` is the shared parent row for every AI content
--           generation request (notes, flashcards, assignments, quizzes...).
--           `notes` holds the content for note-shaped kinds: notes,
--           revision_notes, one_day_revision, mind_map, formula_sheet,
--           important_questions, expected_questions, eli_beginner,
--           eli_professor.
-- Depends : 0002_enums.sql, 0003_profiles.sql, 0005_uploads.sql
-- ============================================================================

create table public.generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  upload_id     uuid references public.uploads (id) on delete set null,
  kind          public.generation_kind not null,
  title         text not null,
  status        public.upload_status not null default 'pending',
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.generations is
  'One row per AI generation request, regardless of kind. Child tables (notes, flashcard_decks, assignments, quizzes, ...) hold the kind-specific payload. status reuses upload_status as a generic pipeline state (pending/processing/ready/failed).';

create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  content_md    text not null,
  word_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (generation_id)
);

comment on table public.notes is
  'Markdown content for note-shaped generation kinds. One-to-one with generations.';
