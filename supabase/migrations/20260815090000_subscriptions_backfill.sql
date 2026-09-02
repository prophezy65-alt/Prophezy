-- ============================================================================
-- PROPHEZY — 20260815090000_subscriptions_backfill.sql
-- Purpose : One-time data backfill, same category of gap as
--           20260814090000_credit_balances_backfill.sql, one table over.
--
--           public.credit_summary (20260813120200_credit_system_functions.sql)
--           joins credit_balances to subscriptions with an INNER JOIN:
--
--             from public.credit_balances cb
--             join public.subscriptions s on s.user_id = cb.user_id
--             join public.plans p on p.id = s.plan_tier::text
--
--           Confirmed directly in Supabase: after the credit_balances
--           backfill, both test accounts have a real credit_balances row
--           (balance = 5) but NO subscriptions row at all — so the INNER
--           JOIN excludes them from credit_summary entirely, which is why
--           getCreditSummary() still returned null even after the previous
--           fix. This migration inserts a subscriptions row — with the
--           exact same values handle_new_user() uses for a brand-new
--           signup (plan_tier='free', status='none') — for any account
--           that's missing one. Purely additive: `where not exists`
--           guarantees this only touches accounts with zero subscriptions
--           rows; anyone with a real subscription (free, pro, or premium)
--           is left completely untouched.
-- Depends : 0015_subscriptions.sql, 20260814090000_credit_balances_backfill.sql
-- ============================================================================

insert into public.subscriptions (user_id, plan_tier, status)
select p.id, 'free', 'none'
from public.profiles p
where not exists (
  select 1 from public.subscriptions s where s.user_id = p.id
);
