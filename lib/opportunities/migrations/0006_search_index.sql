-- lib/opportunities/migrations/0006_search_index.sql
--
-- One denormalized row per active-enough opportunity, optimized for
-- filtering/sorting/full-text search without joining across
-- opportunities/opportunity_tags on every query. Rebuilt (or
-- incrementally updated) by the indexing service whenever its source
-- opportunity changes.

create table if not exists search_index (
  opportunity_id uuid primary key references opportunities (id) on delete cascade,

  type opportunity_type not null,
  status opportunity_status not null,
  title text not null,
  organization_name text not null,

  search_text text not null,
  search_vector tsvector generated always as (to_tsvector('english', search_text)) stored,

  categories text[] not null default '{}',
  technologies text[] not null default '{}',
  work_mode work_mode not null default 'unspecified',
  city text,
  country text,
  experience_level experience_level not null default 'any',
  eligible_countries text[] not null default '{}',

  application_deadline timestamptz,
  posted_at timestamptz,

  indexed_at timestamptz not null default now()
);

create index if not exists search_index_search_vector_idx on search_index using gin (search_vector);
create index if not exists search_index_type_idx on search_index (type);
create index if not exists search_index_status_idx on search_index (status);
create index if not exists search_index_deadline_idx on search_index (application_deadline);
create index if not exists search_index_posted_at_idx on search_index (posted_at desc);
create index if not exists search_index_country_idx on search_index (country);
create index if not exists search_index_work_mode_idx on search_index (work_mode);
create index if not exists search_index_technologies_gin_idx on search_index using gin (technologies);
create index if not exists search_index_categories_gin_idx on search_index using gin (categories);

alter table search_index enable row level security;

create policy search_index_select_authenticated on search_index
  for select
  to authenticated
  using (true);

create policy search_index_service_role_all on search_index
  for all
  to service_role
  using (true)
  with check (true);
