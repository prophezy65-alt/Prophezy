-- ============================================================================
-- PROPHEZY — 0013_research_topics.sql
-- Purpose : Platform-curated trending research topics (system/admin
--           populated, surfaced to all users — not owned by any one student).
-- Depends : 0001_extensions.sql
-- ============================================================================

create table public.trending_research_topics (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  field        text not null,
  summary      text,
  source_url   text,
  trend_score  numeric(5, 2) not null default 0,
  published_at date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
