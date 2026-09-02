-- ============================================================
-- Career Guidance Engine — optional persistence layer
-- ============================================================
-- ADDITIVE ONLY. This migration creates NEW tables for the
-- Career Guidance module. It does not alter, drop, or rename
-- any existing table, column, or policy from other modules.
--
-- These tables are optional: the engine works from the
-- in-memory/stub providers in this module without them. Wire
-- a real repository against these tables when ready.
-- Run via `supabase db push` or the Supabase SQL editor.
-- ============================================================

create extension if not exists vector;

-- Cached, generated learning roadmaps per user/target-role.
create table if not exists public.career_roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_role text not null,
  content jsonb not null,
  total_estimated_weeks integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists career_roadmaps_user_idx on public.career_roadmaps(user_id);

alter table public.career_roadmaps enable row level security;

drop policy if exists "career_roadmaps_select_own" on public.career_roadmaps;
create policy "career_roadmaps_select_own" on public.career_roadmaps
  for select using (auth.uid() = user_id);

drop policy if exists "career_roadmaps_insert_own" on public.career_roadmaps;
create policy "career_roadmaps_insert_own" on public.career_roadmaps
  for insert with check (auth.uid() = user_id);

drop policy if exists "career_roadmaps_delete_own" on public.career_roadmaps;
create policy "career_roadmaps_delete_own" on public.career_roadmaps
  for delete using (auth.uid() = user_id);

-- Cached career analytics snapshots (skill score, readiness, etc).
create table if not exists public.career_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analytics jsonb not null,
  generated_at timestamptz not null default now()
);

create index if not exists career_analytics_user_idx on public.career_analytics_snapshots(user_id);

alter table public.career_analytics_snapshots enable row level security;

drop policy if exists "career_analytics_select_own" on public.career_analytics_snapshots;
create policy "career_analytics_select_own" on public.career_analytics_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "career_analytics_insert_own" on public.career_analytics_snapshots;
create policy "career_analytics_insert_own" on public.career_analytics_snapshots
  for insert with check (auth.uid() = user_id);

-- Vector embeddings for semantic search (roles/companies/skills/roadmaps).
-- Populated by an ingestion job, queried by SearchService via a
-- VectorSearchRepository implementation.
create table if not exists public.career_search_embeddings (
  id text not null,
  domain text not null check (domain in ('career', 'company', 'skill', 'roadmap')),
  content text not null,
  embedding vector(768),
  updated_at timestamptz not null default now(),
  primary key (domain, id)
);

create index if not exists career_search_embeddings_vector_idx
  on public.career_search_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- This table is reference/catalog data, not user data — readable by any
-- authenticated user, writable only via service role (ingestion jobs).
alter table public.career_search_embeddings enable row level security;

drop policy if exists "career_search_embeddings_select_all" on public.career_search_embeddings;
create policy "career_search_embeddings_select_all" on public.career_search_embeddings
  for select using (auth.role() = 'authenticated');
