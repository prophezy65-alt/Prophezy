-- ============================================================================
-- PROPHEZY — 20260726000000_internship_recently_viewed.sql
-- Purpose : Per-user view history ("Recently Viewed"). `recordView()` in
--           TrackingService already fires on every detail-page load but
--           previously only bumped the internships.view_count global
--           counter and silently discarded the userId it was given — this
--           table is what that call now also writes to.
-- Depends : 20260723090000_internship_engine.sql
-- ============================================================================

create table if not exists public.internship_views (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  internship_id uuid not null references public.internships(id) on delete cascade,
  viewed_at     timestamptz not null default now(),
  unique (user_id, internship_id)
);

-- One row per (user, internship) — repeat views update viewed_at via upsert
-- rather than accumulating duplicate rows, so "recently viewed" naturally
-- reorders to most-recent-first without ever needing dedup at query time.
create index if not exists internship_views_user_idx
  on public.internship_views (user_id, viewed_at desc);

alter table public.internship_views enable row level security;

drop policy if exists internship_views_own on public.internship_views;
create policy internship_views_own on public.internship_views
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Writes happen via the service-role client (TrackingRepository), same as
-- saved_internships and applications — the policy above is what protects
-- reads when a future client-side query path is added, and defense in depth
-- generally.
