-- ============================================================================
-- PROPHEZY — 0010_projects.sql
-- Purpose : Student projects (AI-generated ideas or self-created), with
--           milestones for tracking progress.
-- Depends : 0002_enums.sql, 0003_profiles.sql, 0007_notes.sql (generations)
-- ============================================================================

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  generation_id uuid references public.generations (id) on delete set null,
  title         text not null,
  description   text,
  tech_stack    text[] not null default '{}',
  status        public.project_status not null default 'idea',
  repo_url      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.project_milestones (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  title        text not null,
  is_completed boolean not null default false,
  position     integer not null default 0,
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
