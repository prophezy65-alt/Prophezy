-- ============================================================================
-- PROPHEZY — 20260813120300_credit_system_rls.sql
-- Purpose : Phase 2B Central Credit System — step 4 of 5.
--           RLS on every new table (same "own row or admin" pattern as
--           0019_rls.sql) + explicit function-execute grants. Because RLS
--           is enabled with ONLY a select policy on credit_balances and
--           credit_transactions, insert/update/delete from the
--           `authenticated` role are denied by default — there is no need
--           for (and this migration deliberately adds no) client-facing
--           write policy on either table. The only write paths are the
--           SECURITY DEFINER functions from the previous migration, which
--           run as the function owner and bypass RLS entirely.
-- Depends : 20260813120200_credit_system_functions.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PLANS  (public catalog — every authenticated user can read it, nobody
-- outside a migration/service_role can write it)
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;

create policy "plans_select_all" on public.plans
  for select using (true);

-- ---------------------------------------------------------------------------
-- FEATURE CREDIT COSTS  (same shape as plans — public read, no client write)
-- ---------------------------------------------------------------------------
alter table public.feature_credit_costs enable row level security;

create policy "feature_credit_costs_select_all" on public.feature_credit_costs
  for select using (true);

-- ---------------------------------------------------------------------------
-- CREDIT BALANCES  (strictly own row; no insert/update/delete policy for
-- any client role — see comment above)
-- ---------------------------------------------------------------------------
alter table public.credit_balances enable row level security;

create policy "credit_balances_select_own_or_admin" on public.credit_balances
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- CREDIT TRANSACTIONS  (strictly own row; append-only via functions, no
-- client write policy at all — a user can never insert a fake +100000 row)
-- ---------------------------------------------------------------------------
alter table public.credit_transactions enable row level security;

create policy "credit_transactions_select_own_or_admin" on public.credit_transactions
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- FUNCTION GRANTS
-- ---------------------------------------------------------------------------

-- spend_credits & can_spend_credits: safe for end users — both resolve the
-- target strictly from auth.uid(), so a caller can only ever affect their
-- own balance and can only ever decrease it.
grant execute on function public.spend_credits(integer, text, text) to authenticated;
grant execute on function public.can_spend_credits(integer) to authenticated;

-- add_credits & allocate_monthly_credits: these can INCREASE a balance and
-- accept an explicit user_id, so they must never be callable by an
-- ordinary authenticated user — only by trusted server-side code running
-- as service_role (createServiceRoleClient() / createAdminClient()).
revoke execute on function public.add_credits(uuid, integer, public.credit_transaction_type, text, text) from public, authenticated;
grant execute on function public.add_credits(uuid, integer, public.credit_transaction_type, text, text) to service_role;

revoke execute on function public.allocate_monthly_credits(uuid) from public, authenticated;
grant execute on function public.allocate_monthly_credits(uuid) to service_role;

-- credit_summary view: security_invoker means it only ever shows what the
-- caller's own RLS already permits, so a plain select grant is safe.
grant select on public.credit_summary to authenticated;
