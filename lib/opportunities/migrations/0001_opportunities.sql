-- lib/opportunities/migrations/0001_opportunities.sql
--
-- Canonical, deduplicated opportunity records. One row per real-world
-- opportunity, regardless of how many provider sources contributed to it
-- (see opportunity_sources.opportunity_id for the fan-in).
--
-- Renumber this file to match your project's existing supabase/migrations
-- sequence before applying (the Prophezy codebase's migrations already run
-- through at least 0020_seed.sql per the existing project structure).

create extension if not exists "pgcrypto";

create type opportunity_type as enum (
  'internship',
  'hackathon',
  'job',
  'competition',
  'open_source_program',
  'workshop',
  'bootcamp',
  'conference',
  'webinar',
  'other'
);

create type opportunity_status as enum (
  'draft',
  'active',
  'expired',
  'archived',
  'rejected'
);

create type work_mode as enum ('remote', 'hybrid', 'onsite', 'unspecified');

create type compensation_type as enum ('paid', 'unpaid', 'stipend', 'equity', 'unspecified');

create type experience_level as enum ('student', 'entry_level', 'mid_level', 'senior', 'any');

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  type opportunity_type not null,
  status opportunity_status not null default 'draft',

  title text not null,
  description text not null,

  organization_name text not null,
  organization_website text,
  organization_logo_url text,

  work_mode work_mode not null default 'unspecified',
  city text,
  region text,
  country text,
  timezone text,

  compensation_type compensation_type not null default 'unspecified',
  compensation_amount_min numeric(12, 2),
  compensation_amount_max numeric(12, 2),
  compensation_currency char(3),
  compensation_period text check (compensation_period in ('hourly', 'monthly', 'yearly', 'one_time')),

  posted_at timestamptz,
  application_opens_at timestamptz,
  application_deadline timestamptz,
  event_starts_at timestamptz,
  event_ends_at timestamptz,

  experience_level experience_level not null default 'any',
  education_levels text[] not null default '{}',
  eligible_countries text[] not null default '{}',
  minimum_age smallint,
  requires_student_status boolean not null default false,
  eligibility_notes text,

  technologies text[] not null default '{}',
  categories text[] not null default '{}',

  application_url text not null,

  dedup_content_hash char(64) not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opportunities_compensation_range_chk
    check (compensation_amount_min is null or compensation_amount_max is null or compensation_amount_min <= compensation_amount_max),
  constraint opportunities_application_window_chk
    check (application_opens_at is null or application_deadline is null or application_opens_at <= application_deadline),
  constraint opportunities_event_window_chk
    check (event_starts_at is null or event_ends_at is null or event_starts_at <= event_ends_at),
  constraint opportunities_minimum_age_chk
    check (minimum_age is null or minimum_age >= 0)
);

create index if not exists opportunities_type_idx on opportunities (type);
create index if not exists opportunities_status_idx on opportunities (status);
create index if not exists opportunities_deadline_idx on opportunities (application_deadline);
create index if not exists opportunities_posted_at_idx on opportunities (posted_at desc);
create index if not exists opportunities_country_idx on opportunities (country);
create index if not exists opportunities_work_mode_idx on opportunities (work_mode);
create index if not exists opportunities_technologies_gin_idx on opportunities using gin (technologies);
create index if not exists opportunities_categories_gin_idx on opportunities using gin (categories);
create unique index if not exists opportunities_dedup_hash_idx on opportunities (dedup_content_hash);

create or replace function opportunities_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists opportunities_touch_updated_at on opportunities;
create trigger opportunities_touch_updated_at
  before update on opportunities
  for each row
  execute function opportunities_set_updated_at();

alter table opportunities enable row level security;

-- Opportunities are shared, non-user-owned infrastructure data: readable by
-- any authenticated user, writable only by the service role (the sync
-- pipeline runs with the service role key, never the end user's session).
create policy opportunities_select_authenticated on opportunities
  for select
  to authenticated
  using (true);

create policy opportunities_service_role_all on opportunities
  for all
  to service_role
  using (true)
  with check (true);
