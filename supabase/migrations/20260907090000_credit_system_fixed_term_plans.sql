-- ============================================================================
-- PROPHEZY — 20260907090000_credit_system_fixed_term_plans.sql
-- Purpose : Corrects a design assumption in the previous migration
--           (20260906090000_credit_system_monthly_reset.sql).
--
-- WHAT WAS WRONG: that migration modeled Pro/Premium as an auto-renewing
--           subscription — a plan stayed active and simply got a fresh
--           credit allowance every month, forever, unless the user
--           explicitly canceled. The actual intended product behavior is a
--           FIXED-TERM PASS: a Pro/Premium purchase grants exactly one
--           calendar month of that plan; at the end of that month, the
--           account automatically reverts to Free (Free's credits, Free's
--           unlock allowance, Free's feature access) UNLESS the student
--           makes a new purchase, which grants a fresh one-month window at
--           whatever tier was just purchased.
--
--           Example: purchase Pro on Sept 7 -> Pro access + 500 credits
--           through Oct 7 -> automatically Free (25 credits) from Oct 7
--           onward -> purchasing Pro or Premium at any later point starts
--           a new one-month window at that tier from the purchase moment.
--
-- WHAT CHANGES:
--   1. ensure_current_billing_period(): now downgrades to Free
--      UNCONDITIONALLY whenever a period rolls over — not only when
--      explicitly canceled. There is no auto-renewal path in this model,
--      so "the period ended" and "the plan ended" are the same event.
--   2. admin_set_user_plan(): now also stamps current_period_start = now(),
--      current_period_end = now() + 1 month whenever a plan is granted —
--      this is the "purchase" moment (today, that's an admin manually
--      granting a plan; the same two lines are what needs to be added
--      wherever a real payment webhook does this in future — see note at
--      the bottom of this file).
--
-- WHAT DOES NOT CHANGE: RLS, grants, admin verification, audit logging,
--           the credit/unlock allocation mechanism itself, or anything
--           outside these two functions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ensure_current_billing_period — unconditional downgrade at rollover.
--    Identical to the previous version except the "if canceled" guard
--    around the downgrade is removed; a rollover always means the
--    purchased term has ended.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_current_billing_period(p_user_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'no subscription found for user %', p_user_id using errcode = 'P0004';
  end if;

  -- No period on record yet, or the current one-month term has ended.
  if v_sub.current_period_end is not null and now() < v_sub.current_period_end then
    return v_sub; -- still within the term that was purchased/granted, no-op
  end if;

  -- FIXED-TERM MODEL: a purchased plan is only ever valid for the single
  -- one-month window it was granted for. Reaching this point means that
  -- window has ended (or never existed), so the account reverts to Free —
  -- unconditionally, regardless of status/cancel_at_period_end. A student
  -- only gets Pro/Premium again by making a new purchase, which calls
  -- admin_set_user_plan() (or the payment webhook, once it exists) and
  -- starts a brand new one-month window at whatever tier was purchased.
  if v_sub.plan_tier <> 'free' then
    v_sub.plan_tier := 'free';
    v_sub.status := 'none';
    v_sub.cancel_at_period_end := false;
  end if;

  -- Advance in fixed 1-month calendar steps (not "now() + 1 month") so a
  -- user who was away for several months lands on the period that
  -- actually contains right now.
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

  -- Resets the balance to whatever plan_tier now is (Free, per the
  -- downgrade above, unless this user was already Free) — reuses the
  -- EXISTING allocation function unchanged.
  perform public.allocate_monthly_credits(p_user_id);

  return v_sub;
end;
$$;

comment on function public.ensure_current_billing_period(uuid) is
  'service_role ONLY. Fixed-term model: a Pro/Premium plan is valid only through its granted current_period_end. Idempotent no-op while that term is still current; once it has elapsed, unconditionally reverts to Free (there is no auto-renewal) and re-allocates the balance via allocate_monthly_credits(). Row-locked, safe under concurrent callers.';

-- ---------------------------------------------------------------------------
-- 2. admin_set_user_plan — every plan grant starts a fresh one-month term.
--    Only addition vs. the original: the two current_period_* lines below.
--    Everything else (admin verification, audit log, allocate call) is
--    byte-for-byte unchanged from 20260815090000_credit_system_phase4_final_economy.sql.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_plan(
  p_admin_id uuid,
  p_user_id uuid,
  p_plan_tier public.plan_tier,
  p_reason text default null
)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_is_admin boolean;
  v_sub public.subscriptions;
begin
  select (role = 'admin') into v_admin_is_admin
  from public.profiles
  where id = p_admin_id;

  if not coalesce(v_admin_is_admin, false) then
    raise exception 'p_admin_id is not an admin' using errcode = '42501';
  end if;

  if auth.uid() is not null and auth.uid() <> p_admin_id then
    raise exception 'p_admin_id must match the authenticated caller' using errcode = '42501';
  end if;

  update public.subscriptions
  set plan_tier = p_plan_tier,
      status = 'active',
      -- NEW: every grant is a fresh one-month term starting now, regardless
      -- of whatever period was previously in effect (upgrade, downgrade,
      -- or re-purchase after expiry all behave the same way: start a new
      -- month from this moment, at this tier).
      cancel_at_period_end = false,
      current_period_start = now(),
      current_period_end = now() + interval '1 month',
      updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  if not found then
    raise exception 'no subscription found for user %', p_user_id using errcode = 'P0004';
  end if;

  perform public.allocate_monthly_credits(p_user_id);

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, metadata)
  values (
    p_admin_id,
    'plan_change',
    'subscriptions',
    v_sub.id,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'new_plan', p_plan_tier,
      'reason', p_reason
    )
  );

  return v_sub;
end;
$$;

comment on function public.admin_set_user_plan(uuid, uuid, public.plan_tier, text) is
  'The ONLY authorized path to change a user''s plan. Every call grants a fresh one-month term at p_plan_tier starting now (fixed-term model — see 20260907090000_credit_system_fixed_term_plans.sql). Verifies p_admin_id is a real admin, reuses allocate_monthly_credits() for the allowance change, and logs to admin_audit_log.';

-- ---------------------------------------------------------------------------
-- IMPORTANT — action needed if/when a real payment webhook exists:
-- Whatever function actually processes a real Cashfree payment
-- (process_cashfree_payment, referenced from lib/payments/payment.service.ts
-- but not found in the provided migrations) MUST set these same two fields
-- when a payment succeeds, exactly like admin_set_user_plan above does:
--
--   current_period_start = now(),
--   current_period_end   = now() + interval '1 month'
--
-- Without that, a real student purchase would grant the plan_tier but NOT
-- start a valid term, and ensure_current_billing_period would treat their
-- period as already-expired (NULL) the very next time they load the app —
-- downgrading them back to Free almost immediately after paying.
-- ---------------------------------------------------------------------------
