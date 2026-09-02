-- ============================================================================
-- PROPHEZY — 0012_research.sql
-- Purpose : Research Hub — papers a student has found/uploaded and summarized.
-- Depends : 0003_profiles.sql, 0005_uploads.sql
-- ============================================================================

create table public.research_papers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  upload_id    uuid references public.uploads (id) on delete set null,
  title        text not null,
  authors      text[] not null default '{}',
  source_url   text,
  abstract     text,
  summary_md   text,
  published_at date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
