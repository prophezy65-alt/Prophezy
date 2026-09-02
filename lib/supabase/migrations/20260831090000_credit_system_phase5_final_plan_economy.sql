-- ============================================================================
-- PROPHEZY — 20260831090000_credit_system_phase5_final_plan_economy.sql
-- Purpose : Phase 5 — FINAL plan economy before production deployment.
--
--   1. Corrects public.plans.monthly_credits to the final approved values.
--      Phase 2B seeded PRO=700 / PREMIUM=1000 as placeholders; Phase 4 only
--      fixed FREE (5 -> 25). PRO and PREMIUM were never revisited until now:
--        FREE     stays 25  (already correct as of Phase 4)
--        PRO      700 -> 500
--        PREMIUM 1000 -> 700
--      Prices (price_inr: free=0, pro=75, premium=100) are already correct
--      and are NOT touched by this migration.
--
--   2. Adds the internship application-unlock allowance to plans.features
--      (the jsonb column that already existed for exactly this purpose —
--      no new column/table). Represents "unlimited" (Premium) as an
--      explicit JSON null under the `monthlyApplicationUnlocks` key rather
--      than an arbitrary large integer, matching the existing convention
--      in lib/credits (getFreeApplicationUnlocksRemaining already returns
--      null to mean "no limit", not a magic number):
--        FREE     -> 5
--        PRO      -> 25
--        PREMIUM  -> null (unlimited)
--
--   3. Uses UPDATE ... SET (not a blind INSERT/reseed), so this only ever
--      corrects the three known rows to the final values above regardless
--      of whatever numbers are currently live — safe to run once against
--      production. Idempotent: re-running this migration produces the same
--      end state every time.
--
-- Depends : 20260813120100_credit_system_tables.sql (plans table + features
--           jsonb column), 20260815090000_credit_system_phase4_final_economy.sql
-- ============================================================================

update public.plans
set monthly_credits = 500,
    features = features || jsonb_build_object('monthlyApplicationUnlocks', 25),
    updated_at = now()
where id = 'pro';

-- Premium: monthlyApplicationUnlocks is an explicit JSON null (not a large
-- number) — unlimitedApplicationUnlocks=true is the unambiguous signal for
-- "no cap"; the null on the numeric key just keeps its type consistent
-- with FREE/PRO for any code that reads it as "number | null".
update public.plans
set monthly_credits = 700,
    features = features || jsonb_build_object('monthlyApplicationUnlocks', null, 'unlimitedApplicationUnlocks', true),
    updated_at = now()
where id = 'premium';

update public.plans
set features = features || jsonb_build_object('monthlyApplicationUnlocks', 5)
where id = 'free';

-- Sanity check: fail the migration loudly if the final state doesn't match
-- the approved economy, rather than silently deploying wrong numbers.
do $$
declare
  v_free_credits integer;
  v_pro_credits integer;
  v_premium_credits integer;
begin
  select monthly_credits into v_free_credits from public.plans where id = 'free';
  select monthly_credits into v_pro_credits from public.plans where id = 'pro';
  select monthly_credits into v_premium_credits from public.plans where id = 'premium';

  if v_free_credits is distinct from 25
     or v_pro_credits is distinct from 500
     or v_premium_credits is distinct from 700 then
    raise exception 'plan economy migration produced unexpected values: free=%, pro=%, premium=%',
      v_free_credits, v_pro_credits, v_premium_credits
      using errcode = 'P0001';
  end if;
end $$;

comment on column public.plans.features is
  'Plan feature flags/config. Known keys as of Phase 5: monthlyApplicationUnlocks (integer | null — null means unlimited), unlimitedApplicationUnlocks (boolean, Premium only, explicit unlimited signal alongside the null above).';
