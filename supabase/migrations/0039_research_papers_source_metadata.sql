-- ============================================================================
-- PROPHEZY — 0039_research_papers_source_metadata.sql
-- Purpose : Adds the source-provenance columns research_papers needs to (a)
--           dedup a paper a user saves twice from Search Papers external
--           results — previously an unconditional INSERT with no dedup at
--           all (see lib/research/services/paper.service.ts
--           savePaperFromSearchResult, fixed alongside this migration) —
--           and (b) let the paper-search merge/dedup logic
--           (paper-search.service.ts's dedupKey()) recognize a saved paper
--           as "the same" arXiv record regardless of whether it came from a
--           live search or the new background sync automation
--           (research_synced_papers — see 0040).
-- Depends : 0012_research.sql
-- ============================================================================

alter table public.research_papers
  add column if not exists source      text,
  add column if not exists source_id   text,
  add column if not exists pdf_url     text,
  add column if not exists categories  text[] not null default '{}';

comment on column public.research_papers.source is
  'Provider a paper saved from external search came from (arxiv, crossref, ...) — null for PDF uploads and generated topic overviews, which have no external provider record.';
comment on column public.research_papers.source_id is
  'Provider-native id (e.g. arXiv id) for a paper saved from external search — paired with `source` as the save-from-search dedup key.';

-- One saved copy per (user, source paper) — the DB-level backstop behind the
-- application-level check in savePaperFromSearchResult(); a partial index so
-- PDF uploads and topic overviews (source is null) stay unconstrained.
create unique index if not exists idx_research_papers_user_source_dedup
  on public.research_papers (user_id, source, source_id)
  where source is not null and source_id is not null;
