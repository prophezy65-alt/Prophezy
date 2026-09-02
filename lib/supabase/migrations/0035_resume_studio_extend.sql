-- ============================================================================
-- PROPHEZY — 0035_resume_studio_extend.sql
-- Purpose : Additive columns needed to wire the Resume Studio backend module
--           (lib/resume-studio/**) to Supabase. Touches no existing row data
--           in a way that could break it — every new column is nullable or
--           backfilled before being made NOT NULL.
-- Depends : 0011_resumes.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- resumes: targeting context + a denormalized "current version" counter so
-- the app doesn't need a second round-trip to resume_versions just to know
-- what version a resume is on.
-- ---------------------------------------------------------------------------
alter table public.resumes
  add column if not exists target_role text,
  add column if not exists target_job_description text,
  add column if not exists current_version integer not null default 1;

-- ---------------------------------------------------------------------------
-- resume_versions: explicit version numbers (previously only orderable by
-- created_at), plus lightweight metadata for the version-history UI.
-- ---------------------------------------------------------------------------
alter table public.resume_versions
  add column if not exists version integer,
  add column if not exists label text,
  add column if not exists created_by uuid references public.profiles (id),
  add column if not exists change_summary text;

-- Backfill version numbers for any pre-existing rows, ordered by creation
-- time per resume. No-op on a fresh table.
update public.resume_versions v
set version = sub.rn
from (
  select id, row_number() over (partition by resume_id order by created_at) as rn
  from public.resume_versions
  where version is null
) sub
where v.id = sub.id;

-- Backfill created_by from the parent resume's owner for any pre-existing
-- rows that predate this column. No-op on a fresh table.
update public.resume_versions v
set created_by = r.user_id
from public.resumes r
where v.resume_id = r.id and v.created_by is null;

alter table public.resume_versions
  alter column version set not null,
  alter column created_by set not null;

create unique index if not exists idx_resume_versions_resume_id_version
  on public.resume_versions (resume_id, version);
