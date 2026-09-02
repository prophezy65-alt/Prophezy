-- ============================================================================
-- PROPHEZY — 20260801000000_study_hub_shared.sql
-- Purpose : Shared cross-domain infrastructure for the Study Hub module.
--           `bookmarks` and `study_sessions` already exist (0015) and are
--           reused as-is — no changes to either. The one genuinely missing
--           piece is generic "recently viewed" tracking across the same
--           polymorphic entity types `bookmarks` already established.
--           Mirrors that table's exact convention (profiles(id) FK, same
--           entity_type check list) rather than inventing a new pattern —
--           and mirrors internship_views' upsert-on-repeat-view design
--           (20260726000000), which was already tested against real
--           Postgres for correctness.
-- Depends : 0015_subscriptions.sql (bookmarks, study_sessions)
-- ============================================================================

create table if not exists public.content_views (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in (
                'note', 'flashcard_deck', 'assignment', 'quiz', 'project',
                'resume', 'research_paper', 'trending_research_topic', 'internship'
              )),
  entity_id   uuid not null,
  viewed_at   timestamptz not null default now(),

  unique (user_id, entity_type, entity_id)
);

create index if not exists content_views_user_idx
  on public.content_views (user_id, viewed_at desc);

create index if not exists content_views_user_type_idx
  on public.content_views (user_id, entity_type, viewed_at desc);

alter table public.content_views enable row level security;

drop policy if exists content_views_all_own on public.content_views;
create policy content_views_all_own on public.content_views
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
