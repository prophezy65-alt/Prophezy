-- =====================================================================
-- Prophezy — Internship Discovery & Aggregation Engine
-- Additive migration. Touches no existing table.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "vector";

-- 0014 created simpler internships + internship_applications tables.
-- The Internship Discovery Engine supersedes them; drop the old ones so the
-- create-table-if-not-exists blocks below create the new shape (skills, etc.).
drop table if exists public.internship_applications cascade;
drop table if exists public.internships cascade;
drop table if exists public.notifications cascade;
drop table if exists public.notification_preferences cascade;

-- 0002_enums.sql already defines application_status with a smaller value set;
-- the engine's create-type is skipped (duplicate). Add the missing values so
-- the applications table + its indexes can reference them.



-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type work_mode as enum ('remote', 'hybrid', 'onsite');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_type as enum (
    'internship','apprenticeship','co_op','trainee','fellowship',
    'part_time','full_time','contract','volunteer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum (
    'saved','applied','interview_scheduled','rejected','offer','accepted','withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_kind as enum (
    'daily_digest','weekly_digest','new_internship','deadline_reminder',
    'matching_internship','company_alert','role_alert');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('in_app','email','push');
exception when duplicate_object then null; end $$;

do $$ begin
  create type provider_status as enum ('active','degraded','disabled','unsupported','unconfigured');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sync_status as enum ('running','success','partial','failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------
create table if not exists public.providers (
  key                   text primary key,
  label                 text not null default '',
  status                provider_status not null default 'unconfigured',
  reachable             boolean not null default false,
  latency_ms            integer,
  message               text,
  consecutive_failures  integer not null default 0,
  checked_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------
create table if not exists public.companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  website       text,
  domain        text,
  logo_url      text,
  description   text,
  industry      text,
  hq_country    text,
  posting_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists companies_name_trgm_idx on public.companies using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- internships
-- ---------------------------------------------------------------------
create table if not exists public.internships (
  id                   uuid primary key default gen_random_uuid(),
  fingerprint          text not null unique,

  title                text not null,
  normalized_title     text not null default '',

  company_id           uuid references public.companies(id) on delete set null,
  company_name         text not null,
  company_slug         text not null,
  company_website      text,
  company_logo_url     text,
  company_domain       text,

  city                 text,
  state                text,
  country              char(2),
  location_raw         text,

  work_mode            work_mode not null default 'onsite',
  employment_type      employment_type not null default 'internship',

  stipend_min          numeric(14,2),
  stipend_max          numeric(14,2),
  stipend_currency     text,
  stipend_period       text,
  is_unpaid            boolean not null default false,
  stipend_monthly_inr  numeric(14,2),
  stipend_raw          text,

  duration_months      numeric(5,1),
  duration_raw         text,

  skills               text[] not null default '{}',
  degrees              text[] not null default '{}',
  branches             text[] not null default '{}',
  eligible_years       integer[] not null default '{}',
  min_cgpa             numeric(4,2),
  eligibility_notes    text[] not null default '{}',

  description          text not null default '',
  description_html     text,
  apply_url            text not null,

  posted_at            timestamptz,
  deadline_at          timestamptz,
  tags                 text[] not null default '{}',

  sources              jsonb not null default '[]'::jsonb,
  source_confidence    real not null default 0.7,

  is_active            boolean not null default true,
  view_count           integer not null default 0,
  apply_count          integer not null default 0,
  quality_score        real not null default 0.5,

  embedding            vector(768),

  -- NOTE: not a generated column. Postgres rejects to_tsvector(...) as a
  -- generation expression here (42P17: generation expression is not
  -- immutable), so this is populated instead by the
  -- public.set_internship_search_vector() trigger defined in the
  -- companion migration (20260723090100_internship_functions_rls.sql).
  search_vector        tsvector,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint internships_stipend_range check (
    stipend_min is null or stipend_max is null or stipend_max >= stipend_min),
  constraint internships_cgpa_range check (min_cgpa is null or (min_cgpa >= 0 and min_cgpa <= 10))
);

create index if not exists internships_search_idx      on public.internships using gin (search_vector);
create index if not exists internships_skills_idx      on public.internships using gin (skills);
create index if not exists internships_tags_idx        on public.internships using gin (tags);
create index if not exists internships_years_idx       on public.internships using gin (eligible_years);
create index if not exists internships_active_idx      on public.internships (is_active, posted_at desc);
create index if not exists internships_quality_idx     on public.internships (quality_score desc, posted_at desc);
create index if not exists internships_deadline_idx    on public.internships (deadline_at) where is_active;
create index if not exists internships_country_idx     on public.internships (country, work_mode) where is_active;
create index if not exists internships_stipend_idx     on public.internships (stipend_monthly_inr desc nulls last);
create index if not exists internships_company_idx     on public.internships (company_slug);
create index if not exists internships_title_trgm_idx  on public.internships using gin (normalized_title gin_trgm_ops);
create index if not exists internships_updated_idx     on public.internships (updated_at);

-- IVFFlat needs data before it is worth building; safe to create empty.
create index if not exists internships_embedding_idx
  on public.internships using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------
-- normalized join tables
-- ---------------------------------------------------------------------
create table if not exists public.internship_skills (
  internship_id uuid not null references public.internships(id) on delete cascade,
  skill         text not null,
  weight        real not null default 1.0,
  primary key (internship_id, skill)
);
create index if not exists internship_skills_skill_idx on public.internship_skills (skill);

create table if not exists public.company_skills (
  company_id uuid not null references public.companies(id) on delete cascade,
  skill      text not null,
  count      integer not null default 1,
  primary key (company_id, skill)
);

-- ---------------------------------------------------------------------
-- student-facing profile projection
-- ---------------------------------------------------------------------
create table if not exists public.internship_profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  degree                text,
  branch                text,
  graduation_year       integer,
  cgpa                  numeric(4,2),
  skills                text[] not null default '{}',
  preferred_roles       text[] not null default '{}',
  preferred_locations   text[] not null default '{}',
  preferred_work_modes  text[] not null default '{}',
  min_stipend_inr       numeric(14,2),
  resume_text           text,
  resume_embedding      vector(768),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- tracking
-- ---------------------------------------------------------------------
create table if not exists public.saved_internships (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  internship_id uuid not null references public.internships(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (user_id, internship_id)
);
create index if not exists saved_internships_user_idx on public.saved_internships (user_id, created_at desc);

create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  internship_id uuid not null references public.internships(id) on delete cascade,
  status        application_status not null default 'saved',
  applied_at    timestamptz,
  interview_at  timestamptz,
  decision_at   timestamptz,
  deadline_at   timestamptz,
  notes         text,
  documents     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, internship_id)
);
create index if not exists applications_user_status_idx on public.applications (user_id, status);
create index if not exists applications_deadline_idx    on public.applications (deadline_at)
  where status in ('saved','applied','interview_scheduled');

-- ---------------------------------------------------------------------
-- recommendations (AI match cache)
-- ---------------------------------------------------------------------
create table if not exists public.recommendations (
  user_id               uuid not null references auth.users(id) on delete cascade,
  internship_id         uuid not null references public.internships(id) on delete cascade,
  resume_match          smallint not null default 0,
  ats_match             smallint not null default 0,
  eligibility_score     smallint not null default 0,
  application_readiness smallint not null default 0,
  ranking_score         real not null default 0,
  recommendation_score  smallint not null default 0,
  eligible              boolean not null default false,
  matched_skills        text[] not null default '{}',
  missing_skills        text[] not null default '{}',
  skill_gaps            jsonb not null default '[]'::jsonb,
  explanation           jsonb not null default '{}'::jsonb,
  suggested_projects    text[] not null default '{}',
  suggested_courses     text[] not null default '{}',
  interview_prep        text[] not null default '{}',
  model                 text not null default 'unknown',
  computed_at           timestamptz not null default now(),
  primary key (user_id, internship_id)
);
create index if not exists recommendations_user_score_idx
  on public.recommendations (user_id, recommendation_score desc) where eligible;
create index if not exists recommendations_computed_idx on public.recommendations (computed_at);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  daily_digest           boolean not null default true,
  weekly_digest          boolean not null default true,
  new_internship_alerts  boolean not null default true,
  deadline_reminders     boolean not null default true,
  match_alerts           boolean not null default true,
  followed_companies     text[] not null default '{}',
  followed_roles         text[] not null default '{}',
  min_match_score        smallint not null default 70,
  channels               text[] not null default '{in_app}',
  updated_at             timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       notification_kind not null,
  channel    notification_channel not null default 'in_app',
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------
-- sync logs
-- ---------------------------------------------------------------------
create table if not exists public.sync_logs (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,
  run_id      uuid not null,
  status      sync_status not null,
  fetched     integer not null default 0,
  normalized  integer not null default 0,
  duplicates  integer not null default 0,
  inserted    integer not null default 0,
  updated     integer not null default 0,
  duration_ms integer not null default 0,
  error       text,
  warnings    text[] not null default '{}',
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists sync_logs_provider_idx on public.sync_logs (provider, started_at desc);
create index if not exists sync_logs_run_idx      on public.sync_logs (run_id);
create index if not exists sync_logs_success_idx  on public.sync_logs (provider, finished_at desc)
  where status = 'success';
