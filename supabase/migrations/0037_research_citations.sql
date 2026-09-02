-- ============================================================================
-- PROPHEZY — 0037_research_citations.sql
-- Purpose : Citations extracted from a paper's own reference list (distinct
--           from research_papers itself, which is a paper the student added
--           to their library — a citation is a reference *within* that
--           paper's text). Referenced throughout
--           lib/research/services/citation.service.ts but the table was
--           never created — this was blocking not just the Citations tab
--           but basic paper-detail viewing, since
--           app/api/research/papers/[id]/route.ts calls listCitations()
--           unconditionally alongside getPaper().
-- Depends : 0012_research.sql
-- ============================================================================

create table if not exists public.research_citations (
  id         uuid primary key default gen_random_uuid(),
  paper_id   uuid not null references public.research_papers (id) on delete cascade,
  raw_text   text not null,
  title      text,
  authors    text[] not null default '{}',
  year       integer,
  doi        text,
  url        text,
  created_at timestamptz not null default now()
);

create index if not exists idx_research_citations_paper_id
  on public.research_citations (paper_id, created_at);

alter table public.research_citations enable row level security;

-- Ownership is indirect (via the parent paper's user_id), matching how
-- resume_versions/other child tables in this schema check ownership through
-- their parent row rather than duplicating a user_id column here.
create policy "research_citations_select_own_or_admin" on public.research_citations
  for select using (
    exists (
      select 1 from public.research_papers p
      where p.id = research_citations.paper_id
        and (p.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "research_citations_insert_own" on public.research_citations
  for insert with check (
    exists (
      select 1 from public.research_papers p
      where p.id = research_citations.paper_id
        and p.user_id = auth.uid()
    )
  );

create policy "research_citations_delete_own_or_admin" on public.research_citations
  for delete using (
    exists (
      select 1 from public.research_papers p
      where p.id = research_citations.paper_id
        and (p.user_id = auth.uid() or public.is_admin())
    )
  );
