-- ============================================================================
-- PROPHEZY — 20260818090000_credit_system_admin_dashboard_view.sql
-- Purpose : Two things you asked for directly usable from the Supabase
--           dashboard (Table Editor / SQL Editor), no app code involved:
--
--   1. public.admin_user_overview — a VIEW, one row per user, showing
--      email, current plan, price, credit balance/used/allowance, and
--      Free-plan application-unlock usage. Open it under
--      Database > Views (or query it in the SQL Editor) to see
--      "who has what plan" and "who has how many credits" at a glance.
--
--   2. A trigger on subscriptions so that changing a user's plan_tier —
--      including just double-clicking the cell in Table Editor and
--      picking a new value, not only via admin_set_user_plan() — always
--      applies the new plan's credit allowance automatically. Without
--      this, editing the raw table would change the LABEL "PRO" but
--      leave the user's actual credit balance untouched until something
--      else called allocate_monthly_credits().
--
-- IMPORTANT — reading vs. writing:
--   - admin_user_overview is read-only (a view). Use it to SEE data.
--   - To CHANGE a plan: edit subscriptions.plan_tier directly in Table
--     Editor (dropdown-style enum column) — the trigger below then
--     applies the credit allowance for you automatically. This still
--     goes through the exact same allocate_monthly_credits() function
--     admin_set_user_plan() uses, so it's idempotent the same way.
--   - To GRANT/ADJUST credits: do NOT hand-edit credit_balances.balance
--     in Table Editor — that changes the number but leaves no matching
--     row in credit_transactions, silently breaking the audit trail this
--     whole system exists to guarantee. Instead run this in the SQL
--     Editor:
--       select add_credits('<user-uuid>', 100, 'bonus', 'system', 'manual grant');
--     This is one line, takes 5 seconds, and keeps the ledger accurate.
--
-- Depends : 20260813120000..20260815090000 (full credit system),
--           0015_subscriptions.sql (admin_audit_log), 0003_profiles.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Admin overview view
-- ---------------------------------------------------------------------------
create or replace view public.admin_user_overview as
select
  p.id                              as user_id,
  u.email,
  p.full_name,
  s.plan_tier                       as plan,
  pl.name                           as plan_name,
  pl.price_inr,
  pl.monthly_credits                as plan_allowance,
  cb.balance                        as credits_remaining,
  greatest(pl.monthly_credits - cb.balance, 0) as credits_used_this_period,
  s.status                          as subscription_status,
  (
    select count(*)
    from public.credit_transactions ct
    where ct.user_id = p.id
      and ct.feature = 'INTERNSHIP_APPLICATION_UNLOCK'
      and ct.type = 'usage'
      and ct.created_at >= coalesce(
        (
          select max(created_at) from public.credit_transactions
          where user_id = p.id and type = 'monthly_allocation'
        ),
        '1970-01-01'::timestamptz
      )
  )                                  as free_unlocks_used_this_period,
  p.role                            as profile_role,
  s.created_at                      as subscription_created_at,
  cb.updated_at                     as balance_updated_at
from public.profiles p
left join auth.users u on u.id = p.id
left join public.subscriptions s on s.user_id = p.id
left join public.plans pl on pl.id = s.plan_tier::text
left join public.credit_balances cb on cb.user_id = p.id
order by p.id;

comment on view public.admin_user_overview is
  'Dashboard-only overview: one row per user with plan + credit balance + Free-plan unlock usage. Deliberately NOT granted to authenticated/anon — query it from the Supabase SQL Editor or browse it under Database > Views, both of which run as a privileged role that bypasses this restriction. Never expose this view to client code.';

-- Explicitly withhold from client-facing roles — this view joins
-- auth.users (email) and shows every user's data, which must never be
-- reachable from the browser or a normal authenticated session.
revoke all on public.admin_user_overview from public, authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. Auto-allocate credits whenever plan_tier changes, however it changes
-- ---------------------------------------------------------------------------
create or replace function public.on_subscription_plan_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_tier is distinct from old.plan_tier then
    perform public.allocate_monthly_credits(new.user_id);
  end if;
  return new;
end;
$$;

comment on function public.on_subscription_plan_changed() is
  'Fires on any subscriptions.plan_tier change, from any source — admin_set_user_plan(), a raw SQL UPDATE, or a manual edit in the Supabase Table Editor. Reuses allocate_monthly_credits() (same idempotent reset-to-allowance behavior already relied on elsewhere) so a plan change ALWAYS comes with the correct credit allowance, even when nobody remembered to call a function for it.';

drop trigger if exists trg_subscription_plan_changed on public.subscriptions;
create trigger trg_subscription_plan_changed
  after update on public.subscriptions
  for each row
  execute function public.on_subscription_plan_changed();
