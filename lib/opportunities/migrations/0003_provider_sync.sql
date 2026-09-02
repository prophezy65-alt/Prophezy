-- lib/opportunities/migrations/0003_provider_sync.sql
--
-- History of every sync run per provider: what triggered it, how it went,
-- and the incremental-sync cursor at start/end.

create type sync_trigger as enum ('scheduled', 'manual', 'webhook', 'backfill');

create type sync_status as enum ('queued', 'running', 'succeeded', 'partially_succeeded', 'failed');

create table if not exists provider_sync (
  id uuid primary key default gen_random_uuid(),

  provider_id text not null,
  trigger sync_trigger not null,
  status sync_status not null default 'queued',

  cursor_at_start text,
  cursor_at_end text,

  items_fetched integer not null default 0,
  items_created integer not null default 0,
  items_updated integer not null default 0,
  items_skipped integer not null default 0,
  items_failed integer not null default 0,
  error_summaries text[] not null default '{}',

  started_at timestamptz not null default now(),
  finished_at timestamptz,

  constraint provider_sync_finished_after_started_chk
    check (finished_at is null or finished_at >= started_at),
  constraint provider_sync_terminal_requires_finished_chk
    check (status not in ('succeeded', 'partially_succeeded', 'failed') or finished_at is not null),
  constraint provider_sync_nonneg_counts_chk
    check (
      items_fetched >= 0 and items_created >= 0 and items_updated >= 0
      and items_skipped >= 0 and items_failed >= 0
    ),
  constraint provider_sync_counts_within_fetched_chk
    check (items_created + items_updated + items_skipped + items_failed <= items_fetched)
);

create index if not exists provider_sync_provider_idx on provider_sync (provider_id);
create index if not exists provider_sync_status_idx on provider_sync (status);
create index if not exists provider_sync_started_at_idx on provider_sync (started_at desc);

-- Only one non-terminal sync per provider at a time — enforced at the
-- database level so a scheduler retry race can't start two concurrent
-- syncs for the same provider.
create unique index if not exists provider_sync_one_running_per_provider_idx
  on provider_sync (provider_id)
  where status in ('queued', 'running');

alter table provider_sync enable row level security;

create policy provider_sync_service_role_all on provider_sync
  for all
  to service_role
  using (true)
  with check (true);

-- Sync history is useful for an admin/ops dashboard read by authenticated
-- staff; adjust this policy (e.g. restrict to an "admin" role claim) to
-- match your actual admin-access model.
create policy provider_sync_select_authenticated on provider_sync
  for select
  to authenticated
  using (true);
