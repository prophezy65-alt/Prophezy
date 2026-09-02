-- ============================================================================
-- PROPHEZY — 20260810000000_hackathon_sync_engine.sql
-- Purpose : Supports lib/hackathons/engine/ (the new provider aggregation
--           engine, mirroring lib/internships' architecture). Adds a
--           dedicated hackathon_sync_logs table and extends the EXISTING
--           hackathon_providers table (0037_hackathon_engine.sql) with
--           health-tracking columns the new SyncService/HackathonSyncRepository
--           read/write. Deliberately namespaced (hackathon_sync_logs, not
--           a bare sync_logs) — the internship engine already owns tables
--           literally named `providers` and `sync_logs` in this schema;
--           reusing those names here would collide with internship sync
--           history instead of keeping the two engines' state separate.
-- Depends : 0037_hackathon_engine.sql
-- ============================================================================

alter table public.hackathon_providers
  add column if not exists reachable boolean,
  add column if not exists latency_ms integer,
  add column if not exists consecutive_failures integer not null default 0;

comment on column public.hackathon_providers.consecutive_failures is
  'Read by HackathonSyncService''s circuit breaker (lib/hackathons/engine/services/sync.service.ts) — a provider is skipped once this reaches 5, avoiding repeated calls to a source that is clearly down.';

create table if not exists public.hackathon_sync_logs (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  run_id       uuid not null,
  status       text not null check (status in ('success', 'partial', 'failed', 'skipped')),
  fetched      integer not null default 0,
  normalized   integer not null default 0,
  duplicates   integer not null default 0,
  inserted     integer not null default 0,
  updated      integer not null default 0,
  duration_ms  integer not null default 0,
  error        text,
  warnings     text[] not null default '{}',
  started_at   timestamptz not null,
  finished_at  timestamptz not null,
  created_at   timestamptz not null default now()
);

comment on table public.hackathon_sync_logs is
  'Append-only per-provider run log, one row per HackathonAggregatorService#runProvider call within a HackathonSyncService#run. run_id groups every provider''s result for a single sync invocation together.';

create index if not exists hackathon_sync_logs_provider_idx on public.hackathon_sync_logs (provider, started_at desc);
create index if not exists hackathon_sync_logs_run_idx on public.hackathon_sync_logs (run_id);

alter table public.hackathon_sync_logs enable row level security;

-- Sync logs are written by the service-role client (jobs run outside any
-- user session — see lib/internships/db/client.ts#getServiceClient, reused
-- directly by HackathonSyncRepository) and read by an admin-gated API
-- route (app/api/hackathons/sync's existing role='admin' check). No
-- policy grants regular authenticated users access — service-role bypasses
-- RLS entirely, and the admin route also uses the service-role client for
-- reads, so this intentionally has no permissive select policy.
