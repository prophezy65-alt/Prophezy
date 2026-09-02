-- ============================================================================
-- PROPHEZY — 0015_subscriptions.sql
-- Purpose : Billing (subscriptions, payment_transactions) PLUS the remaining
--           cross-module, platform-wide tables that don't belong to any one
--           product module (bookmarks, study_sessions, notifications,
--           admin_audit_log). The requested 20-file layout has no dedicated
--           filename for these, so they're grouped here as "platform
--           tables" — each has zero FK dependency on subscriptions itself.
--           Split into their own migrations later if the team prefers.
-- Depends : 0002_enums.sql, 0003_profiles.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BILLING
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles (id) on delete cascade,
  plan_tier                 public.plan_tier not null default 'free',
  status                    public.subscription_status not null default 'none',
  provider                  text,
  provider_customer_id      text,
  provider_subscription_id  text,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  unique (user_id)
);

create table public.payment_transactions (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid not null references public.subscriptions (id) on delete cascade,
  amount              numeric(10, 2) not null,
  currency            text not null default 'INR',
  status              text not null,
  provider_payment_id text,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BOOKMARKS  (polymorphic — one table for saving any entity type)
-- ---------------------------------------------------------------------------

create table public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in (
                'note', 'flashcard_deck', 'assignment', 'quiz', 'project',
                'resume', 'research_paper', 'trending_research_topic', 'internship'
              )),
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),

  unique (user_id, entity_type, entity_id)
);

comment on column public.bookmarks.entity_id is
  'Not a DB foreign key by design (polymorphic target) — validity is enforced at the application layer.';

-- ---------------------------------------------------------------------------
-- STUDY SESSIONS
-- ---------------------------------------------------------------------------

create table public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  subject          text,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null default 'system',
  title      text not null,
  body       text,
  link_url   text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ADMIN AUDIT LOG
-- ---------------------------------------------------------------------------

create table public.admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.profiles (id) on delete cascade,
  action       text not null,
  target_table text,
  target_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
