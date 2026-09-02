-- ============================================================================
-- PROPHEZY — 20260822090000_research_engine_reconcile.sql
-- Purpose : Fixes two real defects found in the existing research-engine
--           migration set during this audit. Both are self-contained and
--           fully idempotent (drop-if-exists-then-create for every policy,
--           create-or-replace for the function, create-if-not-exists for
--           tables/indexes) — safe to run once, safe to run again, and safe
--           regardless of which of the two historical migration paths below
--           actually ended up applied to this project's database.
--
-- BUG 1 — undefined-function-at-trigger-time (the direct cause of Knowledge
--         Graph 500s):
--   0038_research_knowledge_graphs.sql ends with:
--     create trigger research_knowledge_graphs_touch ...
--       execute function public.touch_updated_at();
--   but public.touch_updated_at() is not defined until
--   20260723090100_internship_functions_rls.sql — which, by filename, sorts
--   AFTER 0038. If migrations apply in filename order (the normal case) and
--   each file runs as one transaction (also normal — Supabase CLI does
--   this), 0038 fails on that last statement with
--   "function public.touch_updated_at() does not exist", and the WHOLE
--   file rolls back — table, indexes, and RLS policies included, not just
--   the trigger. That is exactly what "GET/POST /api/research/knowledge-graph
--   500s" / the Knowledge Graph tab never loading looks like from the API
--   side. This migration re-creates the table/policies/trigger from
--   scratch, self-contained: it (re)defines touch_updated_at() itself
--   first, so this file has no dependency on migration order at all.
--
-- BUG 2 — duplicate/conflicting definitions:
--   0035_research_engine.sql and 0037_research_citations.sql / 0038 above
--   both define research_citations and research_knowledge_graphs
--   (different column sets — 0035's research_citations has a `source_page`
--   column 0037's doesn't; 0035's research_knowledge_graphs.paper_ids is
--   `uuid[]`, 0038's is `text[]` with an `updated_at` column 0035 lacks).
--   `create table if not exists` makes the second file's table creation a
--   safe no-op either way, but `create policy` has no IF NOT EXISTS in
--   Postgres — if both files ever get applied (e.g. 0035 was added to the
--   repo after 0037/0038 had already run, and is still a pending
--   migration), the second one's CREATE POLICY statements fail outright on
--   "policy already exists", aborting that migration and everything queued
--   after it. This migration converges both tables to one canonical,
--   union-of-columns schema and makes every policy on them
--   drop-if-exists-then-create, so re-applying (or applying 0035 late) can
--   never hit this again.
--
-- Depends : 0012_research.sql. Safe to run before or after 0035/0036/0037/
--           0038 and 20260723090100, in any combination/order.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fix 1: (re)define touch_updated_at() here too, so this file is
-- self-sufficient regardless of whether 20260723090100 has run yet.
-- Identical definition — safe to redefine.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- research_citations — canonical schema (union of the 0035 and 0037
-- column sets; source_page kept nullable so 0037's narrower insert shape
-- still works untouched).
-- ---------------------------------------------------------------------------
create table if not exists public.research_citations (
  id           uuid primary key default gen_random_uuid(),
  paper_id     uuid not null references public.research_papers (id) on delete cascade,
  raw_text     text not null,
  title        text,
  authors      text[] not null default '{}',
  year         integer,
  doi          text,
  url          text,
  source_page  integer,
  created_at   timestamptz not null default now()
);

alter table public.research_citations add column if not exists source_page integer;

create index if not exists idx_research_citations_paper_id
  on public.research_citations (paper_id, created_at);

alter table public.research_citations enable row level security;

drop policy if exists "research_citations_select_own_or_admin" on public.research_citations;
create policy "research_citations_select_own_or_admin" on public.research_citations
  for select using (
    exists (
      select 1 from public.research_papers p
      where p.id = research_citations.paper_id
        and (p.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "research_citations_write_own" on public.research_citations;
drop policy if exists "research_citations_insert_own" on public.research_citations;
create policy "research_citations_insert_own" on public.research_citations
  for insert with check (
    exists (
      select 1 from public.research_papers p
      where p.id = research_citations.paper_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "research_citations_delete_own_or_admin" on public.research_citations;
create policy "research_citations_delete_own_or_admin" on public.research_citations
  for delete using (
    exists (
      select 1 from public.research_papers p
      where p.id = research_citations.paper_id
        and (p.user_id = auth.uid() or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- research_knowledge_graphs — canonical schema (0038's paper_ids: text[]
-- + updated_at, since that's what the current TypeScript models
-- (db.types.ts's ResearchKnowledgeGraphInsert) and knowledge-graph.service.ts
-- already write against).
-- ---------------------------------------------------------------------------
create table if not exists public.research_knowledge_graphs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  topic      text not null,
  paper_ids  text[] not null default '{}',
  graph      jsonb not null default '{"nodes": [], "edges": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.research_knowledge_graphs add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_research_knowledge_graphs_user_id
  on public.research_knowledge_graphs (user_id, created_at desc);

alter table public.research_knowledge_graphs enable row level security;

drop policy if exists "research_knowledge_graphs_select_own_or_admin" on public.research_knowledge_graphs;
create policy "research_knowledge_graphs_select_own_or_admin" on public.research_knowledge_graphs
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "research_knowledge_graphs_insert_own" on public.research_knowledge_graphs;
create policy "research_knowledge_graphs_insert_own" on public.research_knowledge_graphs
  for insert with check (user_id = auth.uid());

drop policy if exists "research_knowledge_graphs_delete_own_or_admin" on public.research_knowledge_graphs;
create policy "research_knowledge_graphs_delete_own_or_admin" on public.research_knowledge_graphs
  for delete using (user_id = auth.uid() or public.is_admin());

drop trigger if exists research_knowledge_graphs_touch on public.research_knowledge_graphs;
create trigger research_knowledge_graphs_touch before update on public.research_knowledge_graphs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- research_synced_papers (0040) updated_at trigger — created here rather
-- than in 0040 itself, for the same "guarantee the function already
-- exists" reason as above.
-- ---------------------------------------------------------------------------
drop trigger if exists research_synced_papers_touch on public.research_synced_papers;
create trigger research_synced_papers_touch before update on public.research_synced_papers
  for each row execute function public.touch_updated_at();
