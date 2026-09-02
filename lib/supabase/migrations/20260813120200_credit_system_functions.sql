-- ============================================================================
-- PROPHEZY — 20260813120200_credit_system_functions.sql
-- Purpose : Phase 2B Central Credit System — step 3 of 5.
--           All server-side credit mutation logic. Every function here is
--           SECURITY DEFINER (same pattern as public.apply_flashcard_review
--           in 0017_functions.sql) so it can write to credit_balances /
--           credit_transactions despite those tables having no client-facing
--           INSERT/UPDATE policy.
--
--           Two-tier access model:
--             - spend_credits(...)     -> safe for the `authenticated` role.
--                                          Always resolves the target user
--                                          from auth.uid() internally, so a
--                                          caller can only ever decrease
--                                          THEIR OWN balance. Never accepts
--                                          a user_id parameter.
--             - add_credits(...)       -> service_role ONLY (revoked from
--                                          authenticated/public below). Used
--                                          for monthly allocation, refunds,
--                                          bonuses, and admin adjustments —
--                                          every case where a balance goes
--                                          UP. Never callable by end users,
--                                          which is what stops anyone from
--                                          minting their own credits via a
--                                          fake refund/bonus call.
--             - allocate_monthly_credits(...) -> service_role ONLY. Wraps
--                                          add_credits with the plan-lookup
--                                          logic, meant to be invoked by a
--                                          future scheduled job once billing
--                                          periods are real (see notes below
--                                          and the chat response).
--             - can_spend_credits(...) -> safe for `authenticated`. Read-only
--                                          check against the caller's own
--                                          balance.
--
--           Concurrency: spend_credits takes a row lock via
--           `select ... for update` before checking the balance, exactly
--           like apply_flashcard_review locks the flashcard row before
--           updating its schedule. Two simultaneous spend calls for the same
--           user serialize on that lock — the second one only proceeds after
--           the first commits, so it sees the already-decremented balance
--           and correctly fails the insufficient-balance check instead of
--           letting both succeed.
-- Depends : 20260813120100_credit_system_tables.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- spend_credits: atomic, self-service debit. Raises 'insufficient_credits'
-- (SQLSTATE P0001) if the caller doesn't have enough balance — the balance
-- is left untouched and no transaction row is written on failure.
-- ---------------------------------------------------------------------------
create or replace function public.spend_credits(
  p_amount integer,
  p_feature text,
  p_description text default null
)
returns public.credit_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance public.credit_balances;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be a positive integer' using errcode = '22023';
  end if;

  if p_feature is null or length(trim(p_feature)) = 0 then
    raise exception 'feature is required' using errcode = '22023';
  end if;

  -- Row lock: any concurrent spend/allocation for this same user now queues
  -- behind this transaction instead of racing it.
  select * into v_balance
  from public.credit_balances
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'no credit balance found for user %', v_user_id using errcode = 'P0002';
  end if;

  if v_balance.balance < p_amount then
    raise exception 'insufficient_credits' using errcode = 'P0001',
      detail = format('balance=%s requested=%s', v_balance.balance, p_amount);
  end if;

  update public.credit_balances
  set balance = balance - p_amount,
      updated_at = now()
  where user_id = v_user_id
  returning * into v_balance;

  insert into public.credit_transactions (user_id, amount, type, feature, description)
  values (v_user_id, -p_amount, 'usage', p_feature, p_description);

  return v_balance;
end;
$$;

comment on function public.spend_credits(integer, text, text) is
  'Self-service atomic debit. Always targets auth.uid() — never accepts a user_id. Raises insufficient_credits (P0001) rather than allowing a negative balance.';

-- ---------------------------------------------------------------------------
-- can_spend_credits: read-only self-service check.
-- ---------------------------------------------------------------------------
create or replace function public.can_spend_credits(p_amount integer)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select balance >= p_amount from public.credit_balances where user_id = auth.uid()),
    false
  );
$$;

comment on function public.can_spend_credits(integer) is
  'Read-only self-service check. Does not lock any row — a true result is a hint, not a guarantee, under concurrency. spend_credits is the authoritative gate.';

-- ---------------------------------------------------------------------------
-- add_credits: the ONLY way a balance goes up outside of new-user init.
-- service_role only (grants set in the RLS/grants migration). Explicitly
-- accepts a user_id because it is invoked by trusted server-side code
-- (monthly allocation job, refund-on-failure, admin tooling) acting on
-- behalf of a user, not by that user's own session.
-- ---------------------------------------------------------------------------
create or replace function public.add_credits(
  p_user_id uuid,
  p_amount integer,
  p_type public.credit_transaction_type,
  p_feature text default 'system',
  p_description text default null
)
returns public.credit_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.credit_balances;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be a positive integer' using errcode = '22023';
  end if;

  if p_type = 'usage' then
    raise exception 'add_credits cannot be used with type=usage; use spend_credits' using errcode = '22023';
  end if;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance = public.credit_balances.balance + excluded.balance,
        updated_at = now()
  returning * into v_balance;

  insert into public.credit_transactions (user_id, amount, type, feature, description)
  values (p_user_id, p_amount, p_type, p_feature, p_description);

  return v_balance;
end;
$$;

comment on function public.add_credits(uuid, integer, public.credit_transaction_type, text, text) is
  'service_role ONLY (see grants migration). Every balance increase — monthly allocation, refunds, bonuses, admin adjustments — goes through here so there is exactly one code path that can credit an account.';

-- ---------------------------------------------------------------------------
-- allocate_monthly_credits: resets a user's balance to their current plan's
-- monthly allowance and records the delta as a monthly_allocation
-- transaction. Non-cumulative by design (unused credits do not roll over) —
-- matches "5/month, 700/month, 1000/month" as a per-period allowance rather
-- than a top-up. service_role only.
--
-- NOT wired to a scheduler in this migration: subscriptions.current_period_*
-- is only meaningful once real billing (Razorpay, out of scope here) is
-- driving it. Once that exists, call this from either a Supabase Cron
-- (pg_cron) job that scans subscriptions where current_period_end has just
-- elapsed, or from the Razorpay renewal webhook handler directly. See the
-- chat response for the full explanation.
-- ---------------------------------------------------------------------------
create or replace function public.allocate_monthly_credits(p_user_id uuid)
returns public.credit_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_tier public.plan_tier;
  v_plan_credits integer;
  v_old_balance integer;
  v_delta integer;
  v_balance public.credit_balances;
begin
  select plan_tier into v_plan_tier
  from public.subscriptions
  where user_id = p_user_id;

  if v_plan_tier is null then
    v_plan_tier := 'free';
  end if;

  select monthly_credits into v_plan_credits
  from public.plans
  where id = v_plan_tier::text and is_active;

  if v_plan_credits is null then
    raise exception 'no active plan found for tier %', v_plan_tier using errcode = 'P0003';
  end if;

  select balance into v_old_balance
  from public.credit_balances
  where user_id = p_user_id
  for update;

  v_old_balance := coalesce(v_old_balance, 0);
  v_delta := v_plan_credits - v_old_balance;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, v_plan_credits)
  on conflict (user_id) do update
    set balance = v_plan_credits, updated_at = now()
  returning * into v_balance;

  if v_delta <> 0 then
    insert into public.credit_transactions (user_id, amount, type, feature, description)
    values (
      p_user_id, v_delta, 'monthly_allocation', 'system',
      format('Monthly allocation reset for %s plan (%s credits)', v_plan_tier, v_plan_credits)
    );
  end if;

  return v_balance;
end;
$$;

comment on function public.allocate_monthly_credits(uuid) is
  'service_role ONLY. Resets balance to the plan allowance (non-cumulative) and logs the delta. Intended to be called once per billing period per user by a future scheduler/webhook, not by end users.';

-- ---------------------------------------------------------------------------
-- CREDIT SUMMARY VIEW: the one clean source of truth for Settings (and any
-- other feature) to read plan + balance + usage without recomputing
-- anything itself. security_invoker so it runs with the CALLER's RLS, not
-- the view owner's — required or every user would see every row.
-- ---------------------------------------------------------------------------
create view public.credit_summary
with (security_invoker = true) as
select
  cb.user_id,
  s.plan_tier::text                                                    as plan_id,
  p.name                                                                as plan_name,
  p.monthly_credits,
  cb.balance                                                            as credits_remaining,
  greatest(p.monthly_credits - cb.balance, 0)                           as credits_used_this_period,
  case when p.monthly_credits > 0
    then round(100.0 * greatest(p.monthly_credits - cb.balance, 0) / p.monthly_credits, 1)
    else 0
  end                                                                    as usage_percentage,
  s.status                                                              as subscription_status,
  s.current_period_start,
  s.current_period_end,
  cb.updated_at                                                         as balance_updated_at
from public.credit_balances cb
join public.subscriptions s on s.user_id = cb.user_id
join public.plans p on p.id = s.plan_tier::text;

comment on view public.credit_summary is
  'ONE row per user: current plan + credit balance + usage, joined server-side so Settings (and anything else) never has to compute this itself. security_invoker = true means it is only ever as permissive as the caller''s own RLS on credit_balances/subscriptions/plans.';

-- ---------------------------------------------------------------------------
-- Extend handle_new_user (0017_functions.sql) to also initialize the credit
-- balance for brand-new accounts. CREATE OR REPLACE keeps the existing
-- profiles + subscriptions inserts unchanged and additive-only appends the
-- credit initialization — nothing about auth/profile creation is altered.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free_credits integer;
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.subscriptions (user_id, plan_tier, status)
  values (new.id, 'free', 'none');

  select monthly_credits into v_free_credits from public.plans where id = 'free';
  v_free_credits := coalesce(v_free_credits, 0);

  insert into public.credit_balances (user_id, balance)
  values (new.id, v_free_credits);

  insert into public.credit_transactions (user_id, amount, type, feature, description)
  values (new.id, v_free_credits, 'monthly_allocation', 'system', 'Initial Free plan allocation on signup');

  return new;
end;
$$;
