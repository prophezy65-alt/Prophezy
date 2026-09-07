-- ============================================================================
-- PROPHEZY — 20260906090000_credit_system_monthly_reset.sql
-- Purpose : Implements the automatic monthly credit/unlock reset that
--           20260813120200_credit_system_functions.sql explicitly left
--           unwired ("NOT wired to a scheduler in this migration... call
--           this from either a pg_cron job... or a renewal webhook").
--
--           AUDIT FINDING this migration fixes: allocate_monthly_credits()
--           was only ever invoked from admin_set_user_plan() (an admin
--           manually changing a plan) and handle_new_user() (signup). There
--           was no automatic trigger tied to the calendar month, no cron
--           job, and no webhook wiring — subscriptions.current_period_start
--           / current_period_end were defined in the schema but NEVER SET
--           by any existing code path, so a period-based reset was not
--           merely unscheduled, it was structurally impossible as written.
--           Concretely: a student who used all their credits in Month 1
--           stayed at 0 credits forever after Month 1 ended, with no
--           automatic recovery — only an admin's manual
--           admin_set_user_plan() call (which happens to also reset
--           credits as a side effect of the plan write) could unstick them.
--
-- APPROACH: lazy reset-on-access, not a cron job. Rationale: this project
--           has no confirmed recurring-billing webhook driving renewal
--           (lib/payments is a one-time Cashfree order/checkout flow, not a
--           subscription-mandate flow), and pg_cron requires an extension
--           that may not be enabled on every environment. A reset that only
--           depends on the DB itself, checked at the moment credits are
--           actually read or spent, is simpler, requires no external
--           scheduler, and satisfies "works automatically on next page
--           load" (the actual requirement) at least as well as a cron job
--           would — a cron-based reset still wouldn't help a user who logs
--           in between cron runs anyway. A pg_cron job CAN be added later
--           purely as a proactive/eager version of the same reset (e.g. so
--           balances look reset even for users who haven't opened the app
--           yet) without changing anything below — see the comment at the
--           bottom of this file.
--
-- WHAT COUNTS AS "A MONTH": periods are calendar-fixed 1-month increments
--           anchored to current_period_start, NOT "30 days since last
--           usage" and NOT "30 days since last login" — a period that
--           ended while the user was away is advanced in fixed 1-month
--           steps until the current period actually contains `now()`, so
--           the displayed period is always the real current one regardless
--           of how long the user was gone (see the while-loop below).
--
-- EXPIRED SUBSCRIPTIONS: at the moment a period rolls over, if the
--           subscription is 'canceled' or cancel_at_period_end=true, the
--           plan is downgraded to 'free' as part of that same rollover
--           (matches the existing cancel_at_period_end column's clear,
--           pre-existing intent: cancellation takes effect at period end,
--           not immediately). 'past_due' is deliberately left untouched by
--           this migration — deciding whether a failed payment should
--           immediately downgrade a user is a billing/dunning policy
--           decision, not a monthly-reset mechanics question, and is out of
--           scope for this audit fix.
--
-- SECURITY: every new function is SECURITY DEFINER. The two self-service
--           entry points (ensure_own_current_period, get_credit_summary)
--           resolve auth.uid() internally and never accept a user_id
--           parameter — identical pattern to the existing spend_credits/
--           can_spend_credits — so a student can only ever trigger a
--           reset/read for their OWN row, never anyone else's, and can
--           never engineer an early/extra reset (the function is a no-op
--           if the current period hasn't actually elapsed).
--
-- Depends : 0015_subscriptions.sql, 20260813120100_credit_system_tables.sql,
--           20260813120200_credit_system_functions.sql,
--           20260815090000_credit_system_phase4_final_economy.sql (admin_set_user_plan),
--           20260831090000_credit_system_phase5_final_plan_economy.sql (final plan numbers)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ensure_current_billing_period: the core reset. service_role only —
--    called internally by the SECURITY DEFINER functions below, never
--    granted to authenticated directly (same "privileged primitive wrapped
--    by a self-service entry point" shape as allocate_monthly_credits /
--    admin_set_user_plan).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_current_billing_period(p_user_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
  v_should_reset boolean := false;
begin
  select * into v_sub
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if not found then
    -- Every user gets a subscriptions row from handle_new_user() at signup;
    -- this is defense only, not the expected path.
    raise exception 'no subscription found for user %', p_user_id using errcode = 'P0004';
  end if;

  -- No period on record yet (every pre-existing row, since nothing ever set
  -- these columns before this migration) OR the current period has elapsed.
  if v_sub.current_period_end is null or now() >= v_sub.current_period_end then
    v_should_reset := true;
  end if;

  if not v_should_reset then
    return v_sub;
  end if;

  -- Cancellation takes effect at the end of the period the user already
  -- paid for, not immediately — matches cancel_at_period_end's existing,
  -- pre-existing (if previously unused) intent.
  if v_sub.status = 'canceled' or v_sub.cancel_at_period_end then
    v_sub.plan_tier := 'free';
    v_sub.status := 'none';
    v_sub.cancel_at_period_end := false;
  end if;

  -- Advance in fixed 1-month calendar steps (not "now() + 1 month") so a
  -- user who was away for several months lands on the period that actually
  -- contains right now, rather than one that's still in the past — while
  -- still being anchored to a fixed monthly cadence, not "however many days
  -- since they last checked."
  if v_sub.current_period_start is null then
    v_sub.current_period_start := now();
  end if;
  if v_sub.current_period_end is null then
    v_sub.current_period_end := v_sub.current_period_start + interval '1 month';
  end if;
  while now() >= v_sub.current_period_end loop
    v_sub.current_period_start := v_sub.current_period_end;
    v_sub.current_period_end := v_sub.current_period_start + interval '1 month';
  end loop;

  update public.subscriptions
  set plan_tier = v_sub.plan_tier,
      status = v_sub.status,
      cancel_at_period_end = v_sub.cancel_at_period_end,
      current_period_start = v_sub.current_period_start,
      current_period_end = v_sub.current_period_end,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  -- Resets the balance to whatever plan_tier now is (post any downgrade
  -- above) — reuses the EXISTING allocation function unchanged, so the
  -- non-cumulative "resets to the allowance, doesn't add to it" behavior
  -- and the credit_transactions audit trail both keep working exactly as
  -- they already did for the admin-triggered path.
  perform public.allocate_monthly_credits(p_user_id);

  return v_sub;
end;
$$;

comment on function public.ensure_current_billing_period(uuid) is
  'service_role ONLY. Idempotent no-op unless the caller''s current billing period has actually elapsed (or never existed), in which case it advances current_period_start/end in fixed 1-month steps, downgrades to free if the subscription was canceled/cancel_at_period_end, and reuses allocate_monthly_credits() to reset the balance. Row-locked, safe under concurrent callers.';

revoke execute on function public.ensure_current_billing_period(uuid) from public, authenticated;
grant execute on function public.ensure_current_billing_period(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. ensure_own_current_period: self-service entry point. Same shape as
--    spend_credits/can_spend_credits — resolves auth.uid() internally,
--    never accepts a user_id, so a student can only ever affect their own
--    row and can never trigger this early (it's a no-op until the period
--    has actually elapsed).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_own_current_period()
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return public.ensure_current_billing_period(v_user_id);
end;
$$;

comment on function public.ensure_own_current_period() is
  'Self-service wrapper around ensure_current_billing_period() for auth.uid(). Safe to call from any authenticated context as often as needed — a no-op unless the caller''s period has actually elapsed.';

grant execute on function public.ensure_own_current_period() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_credit_summary: read wrapper for public.credit_summary that
--    guarantees the reset above has run before the row is read. The view
--    itself is intentionally NOT modified (views should stay read-only —
--    embedding a reset call inside a view definition would run it on every
--    row scan of the view, which is not what we want if it's ever selected
--    with a WHERE across multiple users, e.g. from admin tooling).
-- ---------------------------------------------------------------------------
create or replace function public.get_credit_summary()
returns setof public.credit_summary
language sql
security definer
set search_path = public
as $$
  select public.ensure_own_current_period();
  select * from public.credit_summary where user_id = auth.uid();
$$;

comment on function public.get_credit_summary() is
  'Self-service read of the caller''s own credit_summary row, guaranteed to reflect the current billing period (runs ensure_own_current_period() first). Prefer this over selecting public.credit_summary directly from application code.';

grant execute on function public.get_credit_summary() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Embed the same guarantee directly in spend_credits / can_spend_credits
--    — defense in depth so spending is correct even for any future code
--    path that calls these without going through get_credit_summary first.
--    CREATE OR REPLACE keeps every existing behavior of both functions
--    (row-lock ordering, error codes/messages, grants) unchanged; the only
--    addition is the ensure-reset call at the very top of each.
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

  -- NEW: guarantees a student whose period elapsed gets their fresh
  -- allowance BEFORE this spend is evaluated, rather than being stuck
  -- reading a stale (possibly zero) balance from last period.
  perform public.ensure_current_billing_period(v_user_id);

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
  'Self-service atomic debit. Always targets auth.uid() — never accepts a user_id. Runs ensure_current_billing_period() first so a spend right after a period rollover always sees the fresh allowance. Raises insufficient_credits (P0001) rather than allowing a negative balance.';

create or replace function public.can_spend_credits(p_amount integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;

  -- NEW: same guarantee as spend_credits, so "can I afford this" reflects
  -- the current period even if nothing has spent/read since it rolled over.
  perform public.ensure_current_billing_period(v_user_id);

  return coalesce(
    (select balance >= p_amount from public.credit_balances where user_id = v_user_id),
    false
  );
end;
$$;

comment on function public.can_spend_credits(integer) is
  'Read-only self-service check. Runs ensure_current_billing_period() first, then checks the caller''s own balance. Does not lock the balance row itself — a true result is a hint, not a guarantee, under concurrency; spend_credits is the authoritative gate.';

-- can_spend_credits changed from `language sql stable` to `language plpgsql`
-- (needed to call ensure_current_billing_period, which writes) — re-grant
-- explicitly since CREATE OR REPLACE with a changed function body signature
-- class can occasionally require this depending on Postgres version, and
-- it's a harmless no-op if the grant already exists.
grant execute on function public.can_spend_credits(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Backfill: every EXISTING subscription row has current_period_start/end
--    = null (confirmed — no prior migration ever set them). Without this,
--    every single existing user's very next read/spend would trigger a
--    "period has elapsed" reset simultaneously. That reset is safe and
--    correct (it just re-allocates them to their current plan's allowance,
--    which for an active paying user is the right outcome), but doing it
--    as one explicit backfill here — rather than as 1000 simultaneous
--    lazy resets the moment this ships — makes the rollout itself
--    inspectable via credit_transactions instead of indistinguishable from
--    organic usage.
-- ---------------------------------------------------------------------------
do $$
declare
  v_row record;
begin
  for v_row in
    select user_id from public.subscriptions where current_period_end is null
  loop
    perform public.ensure_current_billing_period(v_row.user_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- OPTIONAL FUTURE HARDENING (not applied by this migration — see audit
-- notes): if pg_cron is enabled on this project, a proactive nightly job
-- calling ensure_current_billing_period() for every subscription whose
-- current_period_end has passed would make balances look reset even for
-- users who haven't opened the app since their period rolled over, instead
-- of only resetting the moment they next read/spend. This is a pure
-- eagerness improvement — every correctness guarantee above already holds
-- without it. Sketch, NOT applied here:
--
--   select cron.schedule('reset-monthly-credits', '0 3 * * *', $cron$
--     do $$
--     declare v_row record;
--     begin
--       for v_row in select user_id from public.subscriptions where current_period_end <= now() loop
--         perform public.ensure_current_billing_period(v_row.user_id);
--       end loop;
--     end $$;
--   $cron$);
-- ---------------------------------------------------------------------------
