-- lib/opportunities/migrations/0002_opportunity_sources.sql
--
-- Every raw record ever fetched from a provider, independent of whether
-- it became its own opportunity or was merged into an existing one.
-- Depends on: 0001_opportunities.sql

create type dedup_decision as enum (
  'unique',
  'duplicate_merged',
  'duplicate_discarded',
  'needs_review'
);

create table if not exists opportunity_sources (
  id uuid primary key default gen_random_uuid(),

  provider_id text not null,
  external_id text not null,

  raw_payload jsonb not null,
  raw_content_hash char(64) not null,
  source_url text,

  opportunity_id uuid references opportunities (id) on delete set null,
  dedup_decision dedup_decision not null default 'needs_review',
  dedup_comparisons jsonb not null default '[]',
  dedup_reason text,

  fetched_at timestamptz not null default now(),
  normalized_at timestamptz,
  dedup_resolved_at timestamptz,
  normalization_error text,

  constraint opportunity_sources_provider_external_unique unique (provider_id, external_id),
  constraint opportunity_sources_normalized_after_fetched_chk
    check (normalized_at is null or normalized_at >= fetched_at),
  constraint opportunity_sources_dedup_after_normalized_chk
    check (dedup_resolved_at is null or normalized_at is null or dedup_resolved_at >= normalized_at),
  constraint opportunity_sources_merged_requires_opportunity_chk
    check (dedup_decision not in ('unique', 'duplicate_merged') or opportunity_id is not null),
  constraint opportunity_sources_discarded_forbids_opportunity_chk
    check (dedup_decision <> 'duplicate_discarded' or opportunity_id is null)
);

create index if not exists opportunity_sources_provider_idx on opportunity_sources (provider_id);
create index if not exists opportunity_sources_opportunity_idx on opportunity_sources (opportunity_id);
create index if not exists opportunity_sources_content_hash_idx on opportunity_sources (raw_content_hash);
create index if not exists opportunity_sources_dedup_decision_idx on opportunity_sources (dedup_decision);
create index if not exists opportunity_sources_fetched_at_idx on opportunity_sources (fetched_at desc);
create index if not exists opportunity_sources_payload_gin_idx on opportunity_sources using gin (raw_payload);

alter table opportunity_sources enable row level security;

-- Raw source data is internal pipeline state, not user-facing content: only
-- the service role (sync pipeline, admin dashboards) can read or write it.
create policy opportunity_sources_service_role_all on opportunity_sources
  for all
  to service_role
  using (true)
  with check (true);
