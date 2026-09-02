-- ============================================================================
-- PROPHEZY — 20260804090000_user_settings.sql
-- Purpose : Persistence for the Settings module. Additive only.
--
--           Theme is intentionally NOT duplicated here — it already lives at
--           public.profiles.theme_preference (0003_profiles.sql) and the
--           Settings module reuses that column directly rather than
--           reimplementing it.
-- Depends : 0003_profiles.sql, 0017_functions.sql (set_updated_at)
-- ============================================================================

create table if not exists public.user_settings (
  user_id                    uuid primary key references public.profiles (id) on delete cascade,

  -- Well-known scalar fields get real columns (queryable, constrained).
  language                   text not null default 'en',
  timezone                   text not null default 'UTC',
  gemini_model               text not null default 'gemini-2.5-flash'
                                check (gemini_model in ('gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro')),

  -- Open-ended / evolving preference groups as JSONB so new keys can be
  -- added later without a migration. Each has an application-level default
  -- (lib/settings/defaults.ts) that stays in sync with what's written here.
  notification_preferences   jsonb not null default '{
    "email": {"generationComplete": true, "subscription": true, "internship": true, "research": true, "system": true},
    "inApp": {"generationComplete": true, "subscription": true, "internship": true, "research": true, "system": true, "admin": true}
  }'::jsonb,

  ai_preferences              jsonb not null default '{
    "responseLength": "balanced",
    "creativity": "balanced",
    "autoSaveGenerations": true
  }'::jsonb,

  privacy_preferences         jsonb not null default '{
    "profileVisibility": "private",
    "shareUsageAnalytics": true,
    "allowAiTrainingOnMyData": false
  }'::jsonb,

  appearance_preferences      jsonb not null default '{
    "density": "comfortable",
    "reduceMotion": false,
    "fontScale": "medium"
  }'::jsonb,

  keyboard_shortcuts_enabled  boolean not null default true,

  dashboard_preferences       jsonb not null default '{
    "showAiActivityPanel": true,
    "showRecentDiscoveries": true,
    "showUpcomingDeadlines": true,
    "showQuickActions": true
  }'::jsonb,

  module_preferences          jsonb not null default '{
    "careerGuidance": {"defaultTrack": "fulltime"}
  }'::jsonb,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

comment on table public.user_settings is
  'One row per user, auto-created with defaults on first Settings page load. Theme lives in profiles.theme_preference, not here.';

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_owner_all" on public.user_settings;
create policy "user_settings_owner_all" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep updated_at current on every write, reusing the shared trigger
-- function already defined in 0017_functions.sql rather than duplicating it.
drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
