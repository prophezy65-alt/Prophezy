-- ============================================================================
-- PROPHEZY — 0035_notes_workspace.sql
-- Purpose : Additive support for the Notes AI workspace (folder organization,
--           tags, pinning, generation metadata, stored summaries). Does NOT
--           alter, rename, or drop anything from 0007_notes.sql or any other
--           existing migration — only new nullable/defaulted columns and one
--           new table.
-- Depends : 0002_enums.sql, 0003_profiles.sql, 0007_notes.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- notes_folders: user-owned folders for organizing note-shaped generations.
-- Flat (no nesting) by design — keeps the UI and queries simple; nesting can
-- be added later via a nullable parent_folder_id without breaking this.
-- ---------------------------------------------------------------------------
create table public.notes_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  color      text not null default '#5ff2ff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, name)
);

comment on table public.notes_folders is
  'User-owned folders for organizing note-shaped generations. Referenced by generations.folder_id.';

alter table public.notes_folders enable row level security;

create policy "notes_folders_select_own_or_admin" on public.notes_folders
  for select using (public.is_admin() or user_id = auth.uid());

create policy "notes_folders_insert_own" on public.notes_folders
  for insert with check (user_id = auth.uid());

create policy "notes_folders_update_own_or_admin" on public.notes_folders
  for update using (public.is_admin() or user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notes_folders_delete_own_or_admin" on public.notes_folders
  for delete using (public.is_admin() or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- generations: folder assignment, tags, pin state, and the note-generation
-- parameters (note_type/learning_mode/output_style) so a note can be
-- re-generated with the same settings later. Nullable/defaulted — every
-- existing generation of any kind is unaffected.
-- ---------------------------------------------------------------------------
alter table public.generations
  add column if not exists folder_id     uuid references public.notes_folders (id) on delete set null,
  add column if not exists tags          text[] not null default '{}',
  add column if not exists is_pinned     boolean not null default false,
  add column if not exists note_type     text,
  add column if not exists learning_mode text,
  add column if not exists output_style  text;

comment on column public.generations.folder_id is
  'Optional folder assignment. Primarily used by Notes AI; available to any generation kind.';
comment on column public.generations.note_type is
  'For kind = notes-shaped generations: which of the 16 Notes AI note types produced this (detailed, short, revision, exam, mindmap, flashcards, ...).';

create index if not exists generations_folder_idx on public.generations (folder_id);
create index if not exists generations_tags_idx on public.generations using gin (tags);
create index if not exists generations_user_kind_idx on public.generations (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- notes: a stored summary (so re-showing a note list doesn't need to
-- re-render/truncate full markdown, and "Summaries" can be regenerated
-- independently of the note body).
-- ---------------------------------------------------------------------------
alter table public.notes
  add column if not exists summary text;

comment on column public.notes.summary is
  'Short AI-generated summary, shown in list/card views. Regenerable independently of content_md.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance for notes_folders, consistent with the trigger
-- pattern already used elsewhere (0018_triggers.sql) — reusing that same
-- function rather than defining a new one.
-- ---------------------------------------------------------------------------
create trigger notes_folders_set_updated_at
  before update on public.notes_folders
  for each row execute function public.set_updated_at();
