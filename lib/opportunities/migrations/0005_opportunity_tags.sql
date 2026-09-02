-- lib/opportunities/migrations/0005_opportunity_tags.sql
--
-- Normalized tag catalog (so "React" / "react" / "React.js" collapse to
-- one canonical tag) plus the many-to-many assignment of tags to
-- opportunities that powers technology/category search and facets.

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  category text not null check (category in ('technology', 'category', 'skill', 'industry')),
  synonyms text[] not null default '{}',
  usage_count integer not null default 0,

  constraint tags_usage_count_nonneg_chk check (usage_count >= 0)
);

create index if not exists tags_category_idx on tags (category);
create index if not exists tags_usage_count_idx on tags (usage_count desc);

create table if not exists opportunity_tags (
  opportunity_id uuid not null references opportunities (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  assigned_by text not null default 'normalizer' check (assigned_by in ('provider', 'normalizer', 'manual')),
  assigned_at timestamptz not null default now(),

  primary key (opportunity_id, tag_id)
);

create index if not exists opportunity_tags_tag_idx on opportunity_tags (tag_id);

alter table tags enable row level security;
alter table opportunity_tags enable row level security;

create policy tags_select_authenticated on tags
  for select
  to authenticated
  using (true);

create policy tags_service_role_all on tags
  for all
  to service_role
  using (true)
  with check (true);

create policy opportunity_tags_select_authenticated on opportunity_tags
  for select
  to authenticated
  using (true);

create policy opportunity_tags_service_role_all on opportunity_tags
  for all
  to service_role
  using (true)
  with check (true);
