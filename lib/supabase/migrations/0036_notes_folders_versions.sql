-- ============================================================================
-- PROPHEZY — 0036_notes_folders_versions.sql
-- Purpose : Folders, tags, pinning, a separate short-summary field, and
--           version history for notes. Confirmed required by reading the
--           real frontend (components/notes/*.tsx, lib/notes/hooks/use-notes.ts)
--           — not speculative. 0035_notes_metadata.sql already added
--           note_type/learning_mode/output_style; this adds the rest.
-- Depends : 0007_notes.sql, 0035_notes_metadata.sql
-- ============================================================================

create table public.note_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  color      text not null default '#8b5cf6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, name)
);

comment on table public.note_folders is
  'User-scoped note folders. Owned directly by user_id (unlike notes, which owns through generations) since a folder has no AI-generation event behind it.';

alter table public.notes
  add column if not exists folder_id uuid references public.note_folders (id) on delete set null,
  add column if not exists tags      text[] not null default '{}',
  add column if not exists is_pinned boolean not null default false,
  add column if not exists summary   text;

comment on column public.notes.summary is
  'Short AI-generated summary, distinct from content_md (the full note body). Populated by lib/notes/services/summary.service.ts, regenerable independently via POST /api/notes/:id/summary without re-running full note generation.';

create table public.note_versions (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes (id) on delete cascade,
  content_md  text not null,
  word_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.note_versions is
  'Append-only snapshot log. A row is inserted with the PRE-edit content right before an autosave overwrites notes.content_md, so "restore" always has something to roll back to.';

create index if not exists notes_folder_id_idx on public.notes (folder_id);
create index if not exists notes_is_pinned_idx on public.notes (is_pinned) where is_pinned;
create index if not exists notes_tags_gin_idx on public.notes using gin (tags);
create index if not exists note_folders_user_idx on public.note_folders (user_id);
create index if not exists note_versions_note_idx on public.note_versions (note_id, created_at desc);

-- ---- RLS -------------------------------------------------------------

alter table public.note_folders enable row level security;
alter table public.note_versions enable row level security;

create policy note_folders_owner_all on public.note_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy note_versions_owner_all on public.note_versions
  for all using (
    exists (
      select 1 from public.notes n
      join public.generations g on g.id = n.generation_id
      where n.id = note_versions.note_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.notes n
      join public.generations g on g.id = n.generation_id
      where n.id = note_versions.note_id and g.user_id = auth.uid()
    )
  );
