-- ============================================================================
-- PROPHEZY — 0011_resumes.sql
-- Purpose : Resume Builder + ATS Checker.
-- Depends : 0002_enums.sql, 0003_profiles.sql, 0004_storage.sql (resumes bucket)
-- ============================================================================

create table public.resumes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  template   text not null default 'classic',
  content    jsonb not null default '{}'::jsonb,
  status     public.resume_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resume_versions (
  id         uuid primary key default gen_random_uuid(),
  resume_id  uuid not null references public.resumes (id) on delete cascade,
  content    jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ats_checks (
  id              uuid primary key default gen_random_uuid(),
  resume_id       uuid not null references public.resumes (id) on delete cascade,
  job_description text not null,
  score           smallint not null check (score between 0 and 100),
  feedback        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.resume_versions is
  'Snapshot written on every save, enabling version history / revert.';
comment on table public.ats_checks is
  'One row per ATS scan a user runs against a resume + job description.';
