-- ============================================================================
-- PROPHEZY — 20260729120000_career_guidance.sql
-- Purpose : Persistence for the Career Guidance module (lib/career).
--           ADDITIVE ONLY — does not alter, drop, or rename any existing
--           table, column, or policy from other modules.
--
--           Advisor chat history is intentionally NOT duplicated here — it
--           reuses the existing public.chat_sessions / public.chat_messages
--           tables (0030_chat_sessions_messages.sql), tagged with the
--           existing chat_module value 'career_guidance_ai'.
-- Depends : 0003_profiles.sql, 0029_chat_enums.sql, 0030_chat_sessions_messages.sql
-- ============================================================================

-- Generated learning roadmaps per user/target-role, with milestone
-- completion tracked in `progress` so "Progress Tracking" doesn't need a
-- separate table.
create table if not exists public.career_roadmaps (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  target_role            text not null,
  content                jsonb not null,
  total_estimated_weeks  integer not null default 0,
  -- { "<milestoneId>": { "completed": true, "completedAt": "<iso>" }, ... }
  progress               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now()
);

comment on table public.career_roadmaps is
  'One row per generated roadmap (career.service.ts profile + roadmap.service.ts milestones). progress is keyed by milestone id and updated by PATCH /api/career/roadmap/[id]/progress.';

create index if not exists career_roadmaps_user_idx on public.career_roadmaps (user_id, created_at desc);

alter table public.career_roadmaps enable row level security;

drop policy if exists "career_roadmaps_owner_all" on public.career_roadmaps;
create policy "career_roadmaps_owner_all" on public.career_roadmaps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cached career analytics snapshots (skill score, readiness, composite
-- score, role/industry/company match %). Regenerated on demand, history
-- kept so the dashboard can show a trend.
create table if not exists public.career_analytics_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  analytics    jsonb not null,
  generated_at timestamptz not null default now()
);

comment on table public.career_analytics_snapshots is
  'One row per computed CareerAnalytics snapshot (analytics.service.ts). Newest row per user is the current dashboard state; older rows drive the growth timeline.';

create index if not exists career_analytics_user_idx on public.career_analytics_snapshots (user_id, generated_at desc);

alter table public.career_analytics_snapshots enable row level security;

drop policy if exists "career_analytics_owner_all" on public.career_analytics_snapshots;
create policy "career_analytics_owner_all" on public.career_analytics_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Saved skill-gap analyses per target role, so the Skill Gap Analysis
-- section doesn't need to re-run AI Core on every page load.
create table if not exists public.career_skill_gap_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  target_role text not null,
  content     jsonb not null,
  created_at  timestamptz not null default now()
);

comment on table public.career_skill_gap_reports is
  'One row per skill gap analysis (skills.service.ts#analyzeSkillGap) run for a target role.';

create index if not exists career_skill_gap_user_idx on public.career_skill_gap_reports (user_id, created_at desc);

alter table public.career_skill_gap_reports enable row level security;

drop policy if exists "career_skill_gap_owner_all" on public.career_skill_gap_reports;
create policy "career_skill_gap_owner_all" on public.career_skill_gap_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
