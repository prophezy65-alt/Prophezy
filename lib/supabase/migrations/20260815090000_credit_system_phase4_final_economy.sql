-- ============================================================================
-- PROPHEZY — 20260815090000_credit_system_phase4_final_economy.sql
-- Purpose : Phase 4 — final plan/credit economy.
--   1. FREE plan monthly allowance: 5 -> 25 (PRO/PREMIUM unchanged).
--   2. Canonical feature-cost keys. Phase 2B seeded lowercase keys
--      (notes, resume, research, interview, exam_predictor, ...) as a
--      starting point pending confirmation. This task specifies exact
--      SCREAMING_SNAKE_CASE keys with final costs for 8 features — those
--      keys are now the authoritative ones for those 8 features. The
--      lowercase rows for features NOT in this list (flashcards, quiz,
--      mindmap, ocr, ats, project, humanizer, assignment, roadmap) are
--      left untouched — they're unrelated features, not superseded by
--      this list, and deleting them wasn't asked for.
--      NOTE ON RENAMES: 'resume' and 'research' already had rows from
--      Phase 2B. Since nothing has been wired to spend against those two
--      specific keys yet (only 'notes' was ever connected, and that's
--      migrated to AI_NOTE_GENERATION below), the old lowercase
--      'resume'/'research'/'interview'/'exam_predictor' rows are removed
--      in favor of the new canonical keys rather than kept as duplicates
--      — avoids two cost entries existing for what's really one feature.
--   3. admin_set_user_plan() — the one authorized path for an admin to
--      change a user's plan, reusing allocate_monthly_credits() (no
--      duplicated allocation logic) and writing to the EXISTING
--      admin_audit_log table (0015_subscriptions.sql) for a full audit
--      trail. Idempotent in the same sense allocate_monthly_credits()
--      already is: it resets to the new plan's allowance rather than
--      adding to whatever was there, so re-running it (e.g. a retried
--      admin action) never double-allocates.
-- Depends : 20260813120000..20260813120500 (Phase 2B/3 credit system),
--           0015_subscriptions.sql (admin_audit_log, subscriptions),
--           0017_functions.sql (is_admin)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. FREE plan allowance: 5 -> 25
-- ---------------------------------------------------------------------------
update public.plans
set monthly_credits = 25, updated_at = now()
where id = 'free';

-- ---------------------------------------------------------------------------
-- 2. Canonical feature-cost keys (final, per Phase 4 spec)
-- ---------------------------------------------------------------------------
delete from public.feature_credit_costs
where feature in ('resume', 'research', 'interview', 'exam_predictor');

insert into public.feature_credit_costs (feature, credit_cost, is_active, description) values
  ('PROPHEZY_AI_QUESTION',           1, true, 'A single Prophezy AI chat question/answer turn.'),
  ('AI_NOTE_GENERATION',             2, true, 'AI notes generation/regeneration (lib/notes/services/notes.service.ts).'),
  ('EXAM_PREDICTOR',                 4, true, 'Exam question prediction from syllabus. No AI service exists in lib/ yet — cost configured ahead of the feature being built.'),
  ('RESUME_AI_ANALYSIS',             5, true, 'Resume build/rewrite/ATS analysis (lib/ai/services/resume.service.ts).'),
  ('INTERVIEW_AI_ACTION',            3, true, 'One mock-interview action — question, answer evaluation, or feedback turn (lib/ai/services/interview.service.ts).'),
  ('RESEARCH_PAPER_AI_QUERY',        2, true, 'Research paper summary/citation extraction query (lib/ai/services/research-paper.service.ts).'),
  ('CAREER_GUIDANCE_AI',             2, true, 'Career guidance AI request (lib/ai/services/career.service.ts).'),
  ('INTERNSHIP_APPLICATION_UNLOCK',  1, true, 'Unlocking the real external application link for one internship listing.')
on conflict (feature) do update
  set credit_cost = excluded.credit_cost,
      is_active   = excluded.is_active,
      description = excluded.description,
      updated_at  = now();

-- ---------------------------------------------------------------------------
-- 3. admin_set_user_plan — the one authorized path for a plan change
-- ---------------------------------------------------------------------------
-- p_admin_id is required and independently verified against profiles.role
-- = 'admin' (NOT trusted from the caller's claim) — this works identically
-- whether called from an authenticated admin session (auth.uid() is also
-- cross-checked against it below, defense in depth) or from raw
-- service-role tooling (Supabase SQL editor, an internal script) where
-- there is no auth.uid() session at all. Either way, a non-admin can never
-- successfully call this: the DB itself verifies admin status, not the
-- caller's say-so.
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

  -- Defense in depth: if this IS being called from an authenticated
  -- session (not pure service_role), that session must actually BE the
  -- admin it claims to be acting as.
  if auth.uid() is not null and auth.uid() <> p_admin_id then
    raise exception 'p_admin_id must match the authenticated caller' using errcode = '42501';
  end if;

  update public.subscriptions
  set plan_tier = p_plan_tier,
      status = 'active',
      updated_at = now()
  where user_id = p_user_id
  returning * into v_sub;

  if not found then
    raise exception 'no subscription found for user %', p_user_id using errcode = 'P0004';
  end if;

  -- Reuses the EXISTING monthly allocation function (20260813120200) — no
  -- second/duplicated allocation code path. This both applies the new
  -- plan's credit allowance AND is the reason repeated calls never
  -- double-allocate: it resets balance to the target plan's allowance
  -- (recording only the delta as the transaction amount), it doesn't add
  -- to whatever was already there.
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
  'The ONLY authorized path to change a user''s plan. Verifies p_admin_id is a real admin against profiles.role regardless of call context, reuses allocate_monthly_credits() for the allowance change (idempotent, auditable via credit_transactions), and logs to admin_audit_log. No public/user-facing endpoint should ever call this on a normal user''s behalf.';

revoke execute on function public.admin_set_user_plan(uuid, uuid, public.plan_tier, text) from public;
grant execute on function public.admin_set_user_plan(uuid, uuid, public.plan_tier, text) to authenticated, service_role;
