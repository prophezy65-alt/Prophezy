-- ============================================================================
-- PROPHEZY — 20260813120000_credit_system_enum.sql
-- Purpose : Phase 2B Central Credit System — step 1 of 5.
--           Adds 'premium' to the existing public.plan_tier enum (0002_enums.sql
--           currently only has 'free' | 'pro'). This MUST be its own migration:
--           Postgres does not allow a new enum value to be referenced by name
--           in the same transaction that adds it, and the Supabase CLI runs
--           each migration file in its own transaction. Every later credit-
--           system migration (which reads/writes 'premium') depends on this
--           one having already committed.
-- Depends : 0002_enums.sql
-- ============================================================================

alter type public.plan_tier add value if not exists 'premium';
