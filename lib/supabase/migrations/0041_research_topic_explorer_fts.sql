-- ============================================================================
-- PROPHEZY — 0041_research_topic_explorer_fts.sql  (corrected)
-- Purpose : Turns research_synced_papers (0040) into the backing store for
--           the new deterministic, Gemini-free Topic Explorer.
--
--           Adds:
--             - `keywords` — reserved for a future source that actually
--               supplies distinct keywords; arXiv doesn't, so this stays
--               empty for now rather than being filled with invented data.
--             - `topics` — human-readable domain labels (AI, NLP, Computer
--               Vision, RAG, ...), computed deterministically from each
--               paper's REAL arXiv category codes and, for a few
--               fine-grained labels arXiv's taxonomy doesn't have,
--               from keyword matches against the paper's own title/
--               abstract text — see lib/research/utils/arxiv-categories.ts.
--               Never Gemini, never invented.
--             - `search_text` — a tsvector combining title (weight A),
--               topics/categories (weight B), abstract (weight C), and
--               authors (weight D), so ranked full-text search is a plain
--               indexed query, not a per-request scan.
--
-- CORRECTION vs the first version of this file: `search_text` was
-- originally a `GENERATED ALWAYS AS (...) STORED` column. Postgres
-- rejects that with `42P17: generation expression is not immutable` —
-- the two-argument `to_tsvector('english', text)` form is STABLE, not
-- IMMUTABLE (the text-search config it looks up by name could in theory
-- be redefined), and generated columns require a provably immutable
-- expression. This version computes the same tsvector with a BEFORE
-- INSERT OR UPDATE trigger instead — triggers have no immutability
-- requirement, so this is the standard, well-known workaround, not a
-- hack. Functionally identical: search_text still updates automatically
-- on every insert/update, you just never write to it directly.
--
--           `topics`/`keywords` are populated by the sync script's own
--           upsert (see scripts/sync-research-papers.ts) — this migration
--           only adds the columns/index/trigger; no SQL-side backfill
--           logic for those two, so there's exactly one place
--           (TypeScript) that defines the category -> topic mapping.
-- Depends : 0040_research_synced_papers.sql
-- ============================================================================

alter table public.research_synced_papers
  add column if not exists keywords text[] not null default '{}',
  add column if not exists topics   text[] not null default '{}';

comment on column public.research_synced_papers.keywords is
  'Reserved for a source that supplies real distinct keywords. Empty until one does — never populated with invented terms.';
comment on column public.research_synced_papers.topics is
  'Human-readable domain labels, deterministically derived from real arXiv categories + title/abstract keyword matching (see lib/research/utils/arxiv-categories.ts). Not Gemini-generated.';

alter table public.research_synced_papers
  add column if not exists search_text tsvector;

create or replace function public.research_synced_papers_set_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(new.topics, ' ') || ' ' || array_to_string(new.categories, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.abstract, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(new.authors, ' ')), 'D');
  return new;
end;
$$;

drop trigger if exists research_synced_papers_search_text on public.research_synced_papers;
create trigger research_synced_papers_search_text
  before insert or update on public.research_synced_papers
  for each row execute function public.research_synced_papers_set_search_text();

-- Backfill: the trigger only fires for future inserts/updates, so existing
-- rows (your ~200 already-synced papers) need one manual pass. Re-running
-- the sync script afterward would also do this (it upserts every row it
-- fetches, which fires the trigger) — this UPDATE just makes it correct
-- immediately without waiting on that.
update public.research_synced_papers
set search_text =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', array_to_string(topics, ' ') || ' ' || array_to_string(categories, ' ')), 'B') ||
  setweight(to_tsvector('english', coalesce(abstract, '')), 'C') ||
  setweight(to_tsvector('english', array_to_string(authors, ' ')), 'D')
where search_text is null;

create index if not exists idx_research_synced_papers_search_text
  on public.research_synced_papers using gin (search_text);

-- Powers the topic-chip counts Topic Explorer shows alongside results
-- (e.g. "Computer Vision (412)") without a second query per chip.
create index if not exists idx_research_synced_papers_topics
  on public.research_synced_papers using gin (topics);

-- Superseded by idx_research_synced_papers_search_text for ranked search —
-- the plain ILIKE indexes from 0040 stay in place (they're used by
-- db-synced.provider.ts, which backs Search Papers, not Topic Explorer) but
-- are redundant with FTS for anything Topic Explorer itself does.
