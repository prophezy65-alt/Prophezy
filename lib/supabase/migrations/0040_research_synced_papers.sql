-- ============================================================================
-- PROPHEZY — 0040_research_synced_papers.sql
-- Purpose : Storage for the Background Research Paper Automation Agent
--           (GitHub Actions -> scripts/sync-research-papers.ts).
--
--           This is a NEW table, added only because nothing existing fits:
--           `research_papers` (0012) is a *personal library* table —
--           user_id is `not null` and RLS restricts every row to its owner
--           (0019_rls.sql: "research_papers_select_own_or_admin" —
--           user_id = auth.uid()). Papers the automation discovers need to
--           be visible to every signed-in student, so they structurally
--           cannot live there without loosening that RLS policy and
--           weakening the personal-library guarantee for every other
--           feature that reads research_papers.
--
--           Shape/RLS pattern is intentionally copied from the one existing
--           table built for exactly this "system-populated, everyone can
--           read it" case — trending_research_topics (0013 + 0019) — sized
--           for full paper metadata instead of curated-topic summaries.
--
--           Read side: lib/research/providers/db-synced/db-synced.provider.ts
--           registers this as an ordinary PaperSearchProvider (see
--           provider.registry.ts), so synced papers are merged into
--           GET /api/research/search results — and deduped against live
--           arXiv hits by arxiv_id, via the existing dedup pass in
--           paper-search.service.ts — with ZERO route or UI changes.
-- Depends : 0001_extensions.sql, 0003_profiles.sql, 0017_functions.sql
--           (public.is_admin())
-- ============================================================================

create table if not exists public.research_synced_papers (
  id               uuid primary key default gen_random_uuid(),
  source           text not null,
  source_id        text not null,
  title            text not null,
  abstract         text,
  authors          text[] not null default '{}',
  venue            text,
  published_date   date,
  doi              text,
  arxiv_id         text,
  landing_url      text,
  pdf_url          text,
  html_url         text,
  categories       text[] not null default '{}',
  citation_count   integer,
  raw              jsonb,
  synced_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- The dedup key the sync script upserts on (onConflict: 'source,source_id').
-- Running the job twice — a second scheduled run, or a manual
-- workflow_dispatch right after one — must never create a second row for
-- the same paper.
create unique index if not exists idx_research_synced_papers_source_dedup
  on public.research_synced_papers (source, source_id);

create index if not exists idx_research_synced_papers_published_date
  on public.research_synced_papers (published_date desc nulls last);

create index if not exists idx_research_synced_papers_title_trgm
  on public.research_synced_papers using gin (title extensions.gin_trgm_ops);

create index if not exists idx_research_synced_papers_abstract_trgm
  on public.research_synced_papers using gin (abstract extensions.gin_trgm_ops);

alter table public.research_synced_papers enable row level security;

-- Public read: same shape as trending_research_topics — any signed-in
-- student can see papers the automation has indexed.
drop policy if exists "research_synced_papers_select_authenticated" on public.research_synced_papers;
create policy "research_synced_papers_select_authenticated" on public.research_synced_papers
  for select using (auth.role() = 'authenticated');

-- Write: service-role only. The GitHub Actions job authenticates with
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely — this policy only
-- covers the fallback path of an admin fixing/removing a row by hand (e.g.
-- from the Supabase SQL console while impersonating an admin session). No
-- regular authenticated-user policy exists for insert/update/delete: this
-- table is not user-writable, by design.
drop policy if exists "research_synced_papers_write_admin" on public.research_synced_papers;
create policy "research_synced_papers_write_admin" on public.research_synced_papers
  for all using (public.is_admin()) with check (public.is_admin());

-- touch_updated_at() is defined in 20260723090100_internship_functions_rls.sql.
-- That migration sorts AFTER this one in filename order (see
-- 20260822090000_research_engine_reconcile.sql for the matching bug this
-- exact ordering causes with research_knowledge_graphs's trigger) — so this
-- table's own updated_at trigger is deliberately created in the
-- reconciliation migration instead of here, once the function is guaranteed
-- to exist regardless of apply order.
