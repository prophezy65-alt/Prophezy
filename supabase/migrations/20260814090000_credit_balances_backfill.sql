-- ============================================================================
-- PROPHEZY — 20260814090000_credit_balances_backfill.sql
-- Purpose : One-time data backfill. handle_new_user() (updated in
--           20260813120200_credit_system_functions.sql) only initializes a
--           credit_balances row on a NEW `INSERT INTO auth.users` — it does
--           not retroactively run for accounts that already existed before
--           that migration was applied. Every such account has a real
--           profiles/subscriptions row but no credit_balances row at all,
--           which is why credit_summary (and therefore getCreditSummary())
--           correctly returns nothing for them — there's no bug in the
--           query or the trigger itself, just missing historical data.
--
--           This migration does exactly what handle_new_user does for a
--           brand-new Free signup, applied once to every account currently
--           missing a balance: look up their plan from subscriptions (falls
--           back to 'free' if that's somehow also missing), read that
--           plan's monthly_credits from public.plans, insert the balance,
--           and log the matching monthly_allocation transaction — the same
--           two inserts, in the same order, with the same transaction type.
--
--           Idempotent: `where not exists (...)` on both inserts means
--           running this migration twice (or against a project where it's
--           partially already true) changes nothing on the second run.
-- Depends : 20260813120100_credit_system_tables.sql,
--           20260813120200_credit_system_functions.sql
-- ============================================================================

with missing as (
  select
    p.id as user_id,
    coalesce(pl.monthly_credits, 0) as monthly_credits,
    coalesce(s.plan_tier::text, 'free') as plan_tier
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.id
  left join public.plans pl on pl.id = coalesce(s.plan_tier::text, 'free')
  where not exists (
    select 1 from public.credit_balances cb where cb.user_id = p.id
  )
)
insert into public.credit_balances (user_id, balance)
select user_id, monthly_credits from missing
on conflict (user_id) do nothing;

insert into public.credit_transactions (user_id, amount, type, feature, description)
select
  cb.user_id,
  cb.balance,
  'monthly_allocation',
  'system',
  format('Backfilled initial allocation — account predates the credit system (%s plan)', pl.id)
from public.credit_balances cb
join public.subscriptions s on s.user_id = cb.user_id
join public.plans pl on pl.id = s.plan_tier::text
where cb.balance > 0
  and not exists (
    select 1 from public.credit_transactions ct
    where ct.user_id = cb.user_id
      and ct.type = 'monthly_allocation'
      and ct.feature = 'system'
  );
