-- ============================================================================
-- PROPHEZY — 0036_notes_version_history.sql
-- Purpose : Version history for Notes AI. One new table only — nothing from
--           0007_notes.sql or 0035_notes_workspace.sql is altered.
-- Depends : 0007_notes.sql, 0035_notes_workspace.sql
-- ============================================================================

create table public.note_versions (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references public.notes (id) on delete cascade,
  content_md   text not null,
  word_count   integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.note_versions is
  'Snapshot of a note''s content_md taken immediately before each content-changing edit. Populated by SupabaseNotesRepository.update() — see lib/notes/services/notes.repository.supabase.ts.';

create index note_versions_note_idx on public.note_versions (note_id, created_at desc);

alter table public.note_versions enable row level security;

-- Ownership is via notes -> generations -> user_id, same pattern as
-- 0019_rls.sql uses for the notes table itself.
create policy "note_versions_select_own_or_admin" on public.note_versions
  for select using (
    public.is_admin()
    or exists (
      select 1
      from public.notes n
      join public.generations g on g.id = n.generation_id
      where n.id = note_versions.note_id
        and g.user_id = auth.uid()
    )
  );

-- Versions are written by the server (service role via SupabaseNotesRepository,
-- which already authenticates as the session user through RLS-scoped
-- createClient()) — insert is allowed for the owning user only, matching the
-- select policy, so a version can never be attributed to a note the caller
-- doesn't own.
create policy "note_versions_insert_own" on public.note_versions
  for insert with check (
    exists (
      select 1
      from public.notes n
      join public.generations g on g.id = n.generation_id
      where n.id = note_versions.note_id
        and g.user_id = auth.uid()
    )
  );

-- No update/delete policy: version history is append-only by design. Rows
-- are only ever removed via the cascade when their parent note is deleted.
