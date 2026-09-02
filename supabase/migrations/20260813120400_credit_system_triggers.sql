-- ============================================================================
-- PROPHEZY — 20260813120400_credit_system_triggers.sql
-- Purpose : Phase 2B Central Credit System — step 5 of 5.
--           updated_at maintenance for the new tables, reusing the existing
--           public.set_updated_at() function from 0017_functions.sql rather
--           than duplicating it (same as every trigger in 0018_triggers.sql).
--           credit_balances.updated_at is already set explicitly inside
--           spend_credits/add_credits/allocate_monthly_credits, but the
--           trigger is added anyway as a safety net for any future direct
--           update path.
-- Depends : 20260813120100_credit_system_tables.sql, 0017_functions.sql
-- ============================================================================

create trigger set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.credit_balances
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.feature_credit_costs
  for each row execute function public.set_updated_at();
