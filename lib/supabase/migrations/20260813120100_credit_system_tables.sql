-- ============================================================================
-- PROPHEZY — 20260813120100_credit_system_tables.sql
-- Purpose : Phase 2B Central Credit System — step 2 of 5.
--           Core tables for the ONE authoritative credit system:
--             - plans                 : backend-configured plan catalog
--                                        (reused by the EXISTING public.subscriptions
--                                        table via subscriptions.plan_tier — no
--                                        new subscriptions/plan-membership table
--                                        is created; 0015_subscriptions.sql
--                                        already owns that relationship).
--             - credit_balances       : ONE row per user, server-controlled.
--             - credit_transactions   : append-only audit ledger of every
--                                        credit change.
--             - feature_credit_costs  : central feature -> credit-cost config.
--                                        Created EMPTY on purpose — see the
--                                        chat response for proposed values;
--                                        nothing is seeded here until those
--                                        are confirmed.
--
--           Nothing here duplicates or replaces:
--             - public.subscriptions / public.payment_transactions (0015) —
--               "current plan" is still resolved from subscriptions.plan_tier.
--             - public.ai_usage_events (referenced by lib/ai/middleware/
--               analytics.ts, migration not present in this export) — that
--               table is a per-request token/latency/cost OBSERVABILITY log.
--               credit_transactions is the user-facing BILLING ledger. They
--               answer different questions and are intentionally separate;
--               a future feature integration may write to both from the same
--               call site, but neither table is redundant with the other.
-- Depends : 0002_enums.sql, 0003_profiles.sql, 0015_subscriptions.sql,
--           20260813120000_credit_system_enum.sql (needs 'premium' committed)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CREDIT TRANSACTION TYPE
-- ---------------------------------------------------------------------------
create type public.credit_transaction_type as enum (
  'monthly_allocation',  -- credits granted at the start of a billing/plan period
  'usage',                -- credits spent by an AI feature
  'refund',                -- credits returned after a failed AI request
  'bonus',                  -- one-off manual grant (promo, support gesture)
  'admin_adjustment'         -- manual correction, always via service_role
);

-- ---------------------------------------------------------------------------
-- PLANS  (backend/database configuration — never hardcoded in the frontend)
-- ---------------------------------------------------------------------------
create table public.plans (
  id               text primary key,                 -- matches plan_tier: 'free' | 'pro' | 'premium'
  name             text not null,
  price_inr        numeric(10, 2) not null default 0 check (price_inr >= 0),
  monthly_credits  integer not null check (monthly_credits >= 0),
  is_active        boolean not null default true,
  features         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.plans is
  'Backend-configured plan catalog. subscriptions.plan_tier (0015_subscriptions.sql) is the FK-shaped link: plans.id = subscriptions.plan_tier::text. Frontend must never hardcode price/credit values from this table.';

insert into public.plans (id, name, price_inr, monthly_credits, is_active) values
  ('free',    'Free',    0,   5,    true),
  ('pro',     'Pro',     75,  700,  true),
  ('premium', 'Premium', 100, 1000, true);

-- ---------------------------------------------------------------------------
-- CREDIT BALANCES  (ONE authoritative, server-controlled balance per user)
-- ---------------------------------------------------------------------------
create table public.credit_balances (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  balance     integer not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

comment on table public.credit_balances is
  'ONE row per user. Never written directly by client code — only by the security-definer functions in 20260813120200_credit_system_functions.sql (spend_credits, add_credits, allocate_monthly_credits) or the handle_new_user trigger. balance >= 0 is enforced at the column level as a second line of defense on top of the atomic spend function.';

-- ---------------------------------------------------------------------------
-- CREDIT TRANSACTIONS  (append-only audit ledger)
-- ---------------------------------------------------------------------------
create table public.credit_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  amount       integer not null check (amount <> 0),  -- positive = credit, negative = debit
  type         public.credit_transaction_type not null,
  feature      text not null default 'system',
  description  text,
  created_at   timestamptz not null default now()
);

comment on table public.credit_transactions is
  'Append-only. Every balance change in credit_balances must have a matching row here, written in the same transaction by the same security-definer function. No update/delete policy exists for any client role by design.';

create index idx_credit_transactions_user_id on public.credit_transactions (user_id, created_at desc);
create index idx_credit_transactions_feature on public.credit_transactions (feature);

-- ---------------------------------------------------------------------------
-- FEATURE CREDIT COSTS  (central feature -> credit-cost configuration)
-- ---------------------------------------------------------------------------
create table public.feature_credit_costs (
  feature      text primary key,
  credit_cost  integer not null check (credit_cost >= 0),
  is_active    boolean not null default true,
  description  text,
  updated_at   timestamptz not null default now()
);

comment on table public.feature_credit_costs is
  'Central feature -> credit-cost config so no AI feature hardcodes its own price. Intentionally left EMPTY by this migration — see the accompanying chat response for the proposed cost table per existing feature (lib/ai/config/models.ts FEATURE_MODEL_MAP + exam_predictor). Populate via a follow-up migration once costs are confirmed.';
