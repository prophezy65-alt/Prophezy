-- migrations/20260828090000_project_library.sql
--
-- project_library: a plain, database-only catalog of REAL, pre-existing
-- software projects (open-source repos, published tutorials, etc.) that
-- students can browse, search, and open. This table is deliberately NOT
-- touched by any AI/Gemini code path — see lib/project-library/*, which
-- only ever runs Supabase queries. Content here must be real: a genuine
-- github_url, a genuine source, no invented links.

create type project_library_difficulty as enum ('beginner', 'intermediate', 'advanced');

create table if not exists public.project_library (
  id uuid primary key default gen_random_uuid(),

  -- Identity / dedupe key. external_id is a stable identifier from the
  -- source system (e.g. "github:owner/repo"), used by the import script to
  -- upsert instead of duplicating a project it has already seen.
  external_id text not null unique,
  source text not null,                -- e.g. "github", "curated-list", "kaggle"
  source_url text,                     -- where this record's data was found/verified

  title text not null,
  domain text not null,                -- e.g. "Web Development", "Machine Learning"
  subdomain text,                      -- e.g. "E-commerce", "Computer Vision"
  difficulty project_library_difficulty not null default 'intermediate',

  description text not null,
  problem_statement text,
  solution_overview text,

  tech_stack text[] not null default '{}',
  skills text[] not null default '{}',

  architecture text,                   -- free-form architecture summary
  modules text[] not null default '{}',
  how_it_is_built text,
  development_steps text[] not null default '{}',
  prerequisites text[] not null default '{}',
  expected_output text,

  github_url text,
  demo_url text,
  documentation_url text,
  tutorial_url text,

  dataset_info text,
  api_info text,

  estimated_hours_min integer,
  estimated_hours_max integer,
  team_size_min integer,
  team_size_max integer,

  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_library_github_url_format
    check (github_url is null or github_url ~* '^https://github\.com/[^/]+/[^/]+/?$'),
  constraint project_library_hours_range
    check (estimated_hours_min is null or estimated_hours_max is null or estimated_hours_min <= estimated_hours_max),
  constraint project_library_team_range
    check (team_size_min is null or team_size_max is null or team_size_min <= team_size_max)
);

comment on table public.project_library is
  'Real, pre-existing projects for students to browse. No AI-generated rows — populated only via the import/seed script from verifiable sources.';

-- Search/filter indexes -------------------------------------------------

create index if not exists project_library_domain_idx on public.project_library (domain);
create index if not exists project_library_subdomain_idx on public.project_library (subdomain);
create index if not exists project_library_difficulty_idx on public.project_library (difficulty);
create index if not exists project_library_tech_stack_gin_idx on public.project_library using gin (tech_stack);
create index if not exists project_library_skills_gin_idx on public.project_library using gin (skills);
create index if not exists project_library_published_idx on public.project_library (is_published);

-- Full-text search over the fields users actually search by.
alter table public.project_library add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(coalesce(skills, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(tech_stack, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index if not exists project_library_search_idx on public.project_library using gin (search_vector);

-- updated_at bookkeeping --------------------------------------------------

create or replace function public.set_project_library_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_library_set_updated_at on public.project_library;
create trigger project_library_set_updated_at
  before update on public.project_library
  for each row
  execute function public.set_project_library_updated_at();

-- RLS: this is a public catalog, not user-owned data. Everyone
-- (including anonymous/unauthenticated visitors) can read published rows;
-- only the service role (used by the import script, never the browser)
-- can write.

alter table public.project_library enable row level security;

drop policy if exists project_library_public_read on public.project_library;
create policy project_library_public_read
  on public.project_library
  for select
  to authenticated, anon
  using (is_published = true);

-- No insert/update/delete policy is created for authenticated/anon on
-- purpose: only the service role (which bypasses RLS) may write, via the
-- import script. The application's browser/user-facing API keys can only
-- ever read.
