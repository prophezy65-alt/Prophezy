-- lib/opportunities/migrations/0004_provider_health.sql
--
-- Current rolling health snapshot per provider — one row per provider,
-- upserted after every sync run. Used by the registry to skip/deprioritize
-- unhealthy providers and by dashboards/alerting.

create type provider_health_state as enum ('healthy', 'degraded', 'down', 'unknown');

create table if not exists provider_health (
  provider_id text primary key,

  state provider_health_state not null default 'unknown',
  rolling_success_rate numeric(4, 3) not null default 1.0,
  average_latency_ms integer not null default 0,
  p95_latency_ms integer not null default 0,
  consecutive_failure_count integer not null default 0,

  last_successful_sync_at timestamptz,
  last_failed_sync_at timestamptz,
  last_checked_at timestamptz not null default now(),
  last_error_message text,

  constraint provider_health_success_rate_range_chk
    check (rolling_success_rate >= 0 and rolling_success_rate <= 1),
  constraint provider_health_latency_nonneg_chk
    check (average_latency_ms >= 0 and p95_latency_ms >= 0),
  constraint provider_health_p95_gte_avg_chk
    check (p95_latency_ms >= average_latency_ms),
  constraint provider_health_failure_count_nonneg_chk
    check (consecutive_failure_count >= 0)
);

create index if not exists provider_health_state_idx on provider_health (state);

alter table provider_health enable row level security;

create policy provider_health_service_role_all on provider_health
  for all
  to service_role
  using (true)
  with check (true);

create policy provider_health_select_authenticated on provider_health
  for select
  to authenticated
  using (true);
