-- ============================================================================
-- PROPHEZY — 0038_user_settings_extensions.sql
-- Purpose : Two additive changes:
--           1. public.profiles gains `username` and `bio` — the Settings
--              Profile section needs both and neither existed anywhere.
--           2. Additive extension of public.user_settings
--           (20260804090000_user_settings.sql). Adds three new columns for
--           functionality that table doesn't cover yet:
--             - ai_generation_overrides: temperature/topP/penalties/
--               streaming/reasoning-mode overrides for lib/ai/engine.ts,
--               distinct from ai_preferences (responseLength/creativity/
--               autoSaveGenerations), which is about content style, not
--               generation parameters.
--             - memory_preferences: what Prophezy AI is allowed to
--               remember across sessions — nothing in the existing table
--               covers this at all.
--             - color_theme: one of 8 named color palettes (Settings >
--               Appearance). Deliberately separate from
--               profiles.theme_preference (light/dark/system) — that
--               controls light/dark mode; this controls which dark palette,
--               an independent axis.
--           No existing column, default, or row is touched.
-- Depends : 0003_profiles.sql, 20260804090000_user_settings.sql
-- ============================================================================

alter table public.profiles
  add column username text unique,
  add column bio text;

alter table public.user_settings
  add column ai_generation_overrides jsonb not null default '{}'::jsonb,
  add column memory_preferences jsonb not null default '{
    "conversations": true, "projects": true, "research": true,
    "resumes": true, "interviews": true, "career_goals": true,
    "preferences": true, "uploaded_files": true
  }'::jsonb,
  add column color_theme text not null default 'midnight'
    check (color_theme in (
      'midnight', 'amoled', 'carbon', 'glass', 'ocean', 'purple', 'neon', 'solar'
    ));

comment on column public.user_settings.ai_generation_overrides is
  'Optional overrides layered onto lib/ai/config/models.ts defaults at call time: {temperature?, maxOutputTokens?, topP?, frequencyPenalty?, presencePenalty?, streamingEnabled?, reasoningMode?}. Missing keys mean "use the model default".';
comment on column public.user_settings.memory_preferences is
  'What Prophezy AI may remember across sessions, keyed by category.';
comment on column public.user_settings.color_theme is
  'One of 8 named dark-mode color palettes. Independent of profiles.theme_preference (light/dark/system).';
