-- ============================================================================
-- PROPHEZY — 20260822090000_credit_system_editable_admin_table.sql
-- Purpose : A single, directly-editable "table" — user_id, email,
--           full_name, plan, credits_remaining — for the Supabase Table
--           Editor. Double-click the `plan` cell to change a user's plan,
--           or the `credits_remaining` cell to add/subtract credits,
--           exactly like editing a normal table.
--
--           It's actually a VIEW (it joins 4 tables — profiles, auth.users,
--           subscriptions, credit_balances — and no plain view over
--           multiple tables can be a real editable table). What makes it
--           BEHAVE like one: an INSTEAD OF UPDATE trigger that redirects
--           each cell edit to the correct real table and the correct
--           existing function, so nothing bypasses the audit trail:
--             - editing `plan`             -> updates subscriptions.plan_tier
--                                              -> fires the existing
--                                                 trg_subscription_plan_changed
--                                                 trigger (20260818090000),
--                                                 which reallocates credits
--                                                 to the new plan automatically.
--             - editing `credits_remaining` -> computes the delta and calls
--                                              add_credits(..., 'admin_adjustment')
--                                              -> a real credit_transactions
--                                                 row is created either way,
--                                                 same as any other credit
--                                                 change in this system.
--
-- Also fixes a real gap: add_credits() could previously only ADD (rejected
-- any amount <= 0). "credits_remaining" going down when you type a smaller
-- number is a normal, expected edit, so add_credits() now accepts negative
-- amounts specifically for type='admin_adjustment' (every other type —
-- bonus, refund, monthly_allocation — stays positive-only, unchanged), and
-- still guarantees the balance can never go below zero even for a manual
-- decrease.
--
-- Depends : 20260813120000..20260818090000 (full credit system + the
--           subscriptions plan-change trigger)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. add_credits(): allow negative amounts for admin_adjustment only
-- ---------------------------------------------------------------------------
create or replace function public.add_credits(
  p_user_id uuid,
  p_amount integer,
  p_type public.credit_transaction_type,
  p_feature text default 'system',
  p_description text default null
)
returns public.credit_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance integer;
  v_balance public.credit_balances;
begin
  if p_amount = 0 then
    raise exception 'amount must not be zero' using errcode = '22023';
  end if;

  if p_amount < 0 and p_type <> 'admin_adjustment' then
    raise exception 'negative amounts are only allowed for type=admin_adjustment (got type=%)', p_type
      using errcode = '22023';
  end if;

  if p_type = 'usage' then
    raise exception 'add_credits cannot be used with type=usage; use spend_credits' using errcode = '22023';
  end if;

  if p_amount > 0 then
    -- Original behavior, unchanged: upsert, creating the row if this is
    -- the user's first credit event of any kind.
    insert into public.credit_balances (user_id, balance)
    values (p_user_id, p_amount)
    on conflict (user_id) do update
      set balance = public.credit_balances.balance + excluded.balance,
          updated_at = now()
    returning * into v_balance;
  else
    -- Negative admin_adjustment: the user must already have a balance row
    -- (can't subtract from a row that doesn't exist), and the result must
    -- never go below zero — same guarantee spend_credits() gives self-
    -- service debits, now extended to manual admin decreases too.
    select balance into v_current_balance
    from public.credit_balances
    where user_id = p_user_id
    for update;

    if not found then
      raise exception 'no credit balance found for user % — cannot apply a negative adjustment', p_user_id
        using errcode = 'P0002';
    end if;

    if v_current_balance + p_amount < 0 then
      raise exception 'admin_adjustment would take balance below zero (current=%, adjustment=%)', v_current_balance, p_amount
        using errcode = 'P0001';
    end if;

    update public.credit_balances
    set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id
    returning * into v_balance;
  end if;

  insert into public.credit_transactions (user_id, amount, type, feature, description)
  values (p_user_id, p_amount, p_type, p_feature, p_description);

  return v_balance;
end;
$$;

comment on function public.add_credits(uuid, integer, public.credit_transaction_type, text, text) is
  'service_role ONLY. Positive amounts: monthly_allocation/refund/bonus/admin_adjustment, upserts the balance row. Negative amounts: admin_adjustment ONLY, requires an existing balance row, and is rejected if it would go below zero.';

-- ---------------------------------------------------------------------------
-- 2. The editable view
-- ---------------------------------------------------------------------------
create or replace view public.admin_credit_editor as
select
  p.id                as user_id,
  u.email,
  p.full_name,
  s.plan_tier::text   as plan,
  cb.balance          as credits_remaining
from public.profiles p
left join auth.users u on u.id = p.id
left join public.subscriptions s on s.user_id = p.id
left join public.credit_balances cb on cb.user_id = p.id
order by u.email;

comment on view public.admin_credit_editor is
  'Dashboard-only, directly editable: change `plan` or `credits_remaining` in the Supabase Table Editor and it correctly updates the real tables + credit_transactions via the INSTEAD OF trigger below. Never grant to authenticated/anon — see the revoke statement.';

revoke all on public.admin_credit_editor from public, authenticated, anon;
grant select, update on public.admin_credit_editor to service_role;

-- ---------------------------------------------------------------------------
-- 3. INSTEAD OF UPDATE — redirects each cell edit to the real thing
-- ---------------------------------------------------------------------------
create or replace function public.admin_credit_editor_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer;
begin
  if new.plan is distinct from old.plan then
    update public.subscriptions
    set plan_tier = new.plan::public.plan_tier
    where user_id = old.user_id;
    -- trg_subscription_plan_changed (20260818090000) fires from this
    -- UPDATE automatically and reallocates credits to the new plan — do
    -- NOT also touch credits_remaining here, that trigger already does it
    -- via the real allocate_monthly_credits() path.
  end if;

  if new.credits_remaining is distinct from old.credits_remaining then
    v_delta := new.credits_remaining - old.credits_remaining;
    if v_delta <> 0 then
      perform public.add_credits(
        old.user_id, v_delta, 'admin_adjustment', 'system',
        'Manual edit via admin_credit_editor'
      );
    end if;
  end if;

  return new;
end;
$$;

comment on function public.admin_credit_editor_update() is
  'Makes admin_credit_editor behave like a normal editable table. Plan edits go through subscriptions.plan_tier (which reallocates credits automatically via the existing trigger); credit edits go through add_credits() with type=admin_adjustment, so every manual change still lands a real row in credit_transactions.';

drop trigger if exists trg_admin_credit_editor_update on public.admin_credit_editor;
create trigger trg_admin_credit_editor_update
  instead of update on public.admin_credit_editor
  for each row
  execute function public.admin_credit_editor_update();
