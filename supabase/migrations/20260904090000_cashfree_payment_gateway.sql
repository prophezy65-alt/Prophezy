-- ============================================================================
-- PROPHEZY — 20260904090000_cashfree_payment_gateway.sql
-- Purpose : Cashfree Production Payment Gateway integration.
--
--   1. public.payment_orders — one row per Cashfree order we create.
--      order_id is UNIQUE and is the idempotency key for the whole flow:
--      the create-order API route generates it before ever calling
--      Cashfree, and the webhook handler locks this row by order_id
--      before doing anything. cf_payment_id is also UNIQUE (nullable) so
--      the same Cashfree payment can never be applied twice even if two
--      different order rows somehow reference it.
--
--   2. public.process_cashfree_payment(...) — the ONLY path that turns a
--      Cashfree-verified payment into a plan change + credit grant. It
--      reuses the EXISTING public.allocate_monthly_credits() function
--      (20260813120200_credit_system_functions.sql) — no duplicated
--      allocation logic — and writes to the EXISTING
--      public.payment_transactions table (0015_subscriptions.sql) for
--      auditability. Idempotent: re-invoking with the same order_id after
--      it has already been marked processed is a safe no-op that returns
--      the existing row instead of granting credits a second time.
--
--      This is intentionally a SEPARATE function from
--      public.admin_set_user_plan() (20260815090000): that function
--      requires p_admin_id to be a real admin (profiles.role = 'admin')
--      and is for human admin action only. A payment webhook is not an
--      admin acting on a user's behalf — it is the system fulfilling a
--      transaction the user themselves paid for — so it needs its own
--      authorization model: SECURITY DEFINER, service_role-only EXECUTE,
--      and every fact it acts on (user_id, plan_tier, amount) comes from
--      the payment_orders row THIS SERVER created at order-creation time,
--      never from the webhook payload directly. The webhook payload is
--      only trusted for order_id + payment status + cf_payment_id, and
--      only after HMAC signature verification happens in application code
--      (lib/payments/cashfree.client.ts) before this function is ever
--      called.
--
-- Depends : 0015_subscriptions.sql (subscriptions, payment_transactions),
--           20260813120200_credit_system_functions.sql (allocate_monthly_credits),
--           0002_enums.sql (plan_tier)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. payment_orders
-- ---------------------------------------------------------------------------
create table public.payment_orders (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null unique,          -- our order id, sent to Cashfree as `order_id`
  user_id        uuid not null references public.profiles (id) on delete cascade,
  plan_tier      public.plan_tier not null check (plan_tier in ('pro', 'premium')),
  amount         numeric(10, 2) not null,
  currency       text not null default 'INR',
  status         text not null default 'created'
                   check (status in ('created', 'active', 'paid', 'failed', 'cancelled', 'expired')),
  cf_order_id    text,                          -- Cashfree's own order identifier (echoed back)
  cf_payment_id  text unique,                   -- set once a successful payment is verified
  payment_session_id text,                      -- returned by Cashfree at order creation
  processed      boolean not null default false,-- true once credits/plan have been granted
  raw_webhook    jsonb,                         -- last verified webhook payload, for audit/debugging
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index payment_orders_user_id_idx on public.payment_orders (user_id);
create index payment_orders_status_idx on public.payment_orders (status);

comment on table public.payment_orders is
  'One row per Cashfree order created by /api/payments/create-order. order_id is the idempotency key the webhook handler locks on. Never trust amount/plan_tier from the client — this row is the authoritative record of what the SERVER decided to charge.';

alter table public.payment_orders enable row level security;

-- Users may read their OWN orders (e.g. the return/pending page polling
-- status) but can never insert/update — only service_role (API routes
-- using the service-role client) can write.
create policy payment_orders_select_own
  on public.payment_orders
  for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.payment_orders from authenticated, anon;
grant select on public.payment_orders to authenticated;
grant select, insert, update on public.payment_orders to service_role;

create trigger payment_orders_set_updated_at
  before update on public.payment_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. process_cashfree_payment — the ONLY path from a verified Cashfree
--    payment to a plan change + credit grant. service_role only.
-- ---------------------------------------------------------------------------
create or replace function public.process_cashfree_payment(
  p_order_id      text,
  p_cf_payment_id text,
  p_cf_status     text,     -- normalized: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED'
  p_raw_webhook   jsonb default null
)
returns public.payment_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders;
  v_sub   public.subscriptions;
  v_credits integer;
  v_unlocks integer;
begin
  if p_order_id is null or length(trim(p_order_id)) = 0 then
    raise exception 'p_order_id is required' using errcode = '22023';
  end if;

  -- Row lock: a duplicate/retried webhook for the same order_id queues
  -- behind this transaction instead of racing it. This is what makes the
  -- whole flow idempotent under Cashfree's documented at-least-once
  -- webhook delivery.
  select * into v_order
  from public.payment_orders
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'no payment_orders row for order_id %', p_order_id using errcode = 'P0002';
  end if;

  -- Already processed: no-op, return the existing (already-granted) row.
  -- This is the duplicate-webhook guard — credits are NEVER granted twice
  -- for the same order, no matter how many times Cashfree retries.
  if v_order.processed then
    return v_order;
  end if;

  -- Non-success terminal/interim statuses: record status, do not grant.
  if p_cf_status is distinct from 'SUCCESS' then
    update public.payment_orders
    set status = case
                    when p_cf_status = 'CANCELLED' then 'cancelled'
                    when p_cf_status = 'PENDING' then 'active'
                    else 'failed'
                  end,
        raw_webhook = coalesce(p_raw_webhook, raw_webhook),
        updated_at = now()
    where order_id = p_order_id
    returning * into v_order;

    return v_order;
  end if;

  -- Duplicate payment id reused on a different order (should be
  -- impossible given the unique constraint, but guard explicitly rather
  -- than letting a constraint violation bubble up as a 500).
  if p_cf_payment_id is not null and exists (
    select 1 from public.payment_orders
    where cf_payment_id = p_cf_payment_id and order_id <> p_order_id
  ) then
    raise exception 'cf_payment_id % already applied to a different order' , p_cf_payment_id
      using errcode = '23505';
  end if;

  -- Determine the plan's monthly application-unlock allowance for the
  -- subscription snapshot (credits themselves come from
  -- allocate_monthly_credits, which reads public.plans directly).
  select monthly_credits into v_credits from public.plans where id = v_order.plan_tier::text;

  update public.subscriptions
  set plan_tier = v_order.plan_tier,
      status = 'active',
      provider = 'cashfree',
      provider_customer_id = coalesce(provider_customer_id, v_order.user_id::text),
      provider_subscription_id = v_order.order_id,
      current_period_start = now(),
      current_period_end = now() + interval '1 month',
      cancel_at_period_end = false,
      updated_at = now()
  where user_id = v_order.user_id
  returning * into v_sub;

  if not found then
    raise exception 'no subscription row for user %', v_order.user_id using errcode = 'P0004';
  end if;

  -- Reuses the EXISTING monthly allocation function — resets balance to
  -- the new plan's allowance (non-cumulative, matches how every other
  -- plan change in this system behaves) and writes the credit_transactions
  -- audit row itself.
  perform public.allocate_monthly_credits(v_order.user_id);

  insert into public.payment_transactions
    (subscription_id, amount, currency, status, provider_payment_id)
  values
    (v_sub.id, v_order.amount, v_order.currency, 'success', p_cf_payment_id);

  update public.payment_orders
  set status = 'paid',
      cf_payment_id = p_cf_payment_id,
      processed = true,
      raw_webhook = coalesce(p_raw_webhook, raw_webhook),
      updated_at = now()
  where order_id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.process_cashfree_payment(text, text, text, jsonb) is
  'service_role ONLY. The single authorized path from a signature-verified Cashfree payment to a plan change + credit grant. Locks payment_orders by order_id, is a no-op if already processed (idempotent against duplicate webhooks), and reuses allocate_monthly_credits() for the allowance change. Never call this without having verified the Cashfree webhook HMAC signature first.';

revoke execute on function public.process_cashfree_payment(text, text, text, jsonb) from public, authenticated, anon;
grant execute on function public.process_cashfree_payment(text, text, text, jsonb) to service_role;
