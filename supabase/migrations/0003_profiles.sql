-- ============================================================================
-- PROPHEZY — 0003_profiles.sql
-- Purpose : One row per auth.users row. The identity + preferences table every
--           other module hangs off via user_id. Populated automatically by
--           the handle_new_user trigger (wired in 0018, defined in 0017).
-- Depends : 0001_extensions.sql, 0002_enums.sql
-- ============================================================================

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  role             public.user_role not null default 'student',
  full_name        text not null,
  avatar_url       text,
  college          text,
  branch           text,
  semester         smallint check (semester between 1 and 12),
  theme_preference text not null default 'system'
                     check (theme_preference in ('light', 'dark', 'system')),
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users row. Populated automatically by the handle_new_user trigger (0018).';
