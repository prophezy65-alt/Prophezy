-- =====================================================================
-- Prophezy — Internship Engine: functions, triggers, views, RLS
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists internships_touch on public.internships;
create trigger internships_touch before update on public.internships
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- search_vector maintenance
-- (search_vector is a plain tsvector column, not a generated column --
-- see note in 20260723090000_internship_engine.sql for why)
-- ---------------------------------------------------------------------
create or replace function public.set_internship_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.company_name, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(new.skills, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.city, '') || ' ' || coalesce(new.state, '')), 'C') ||
    setweight(to_tsvector('english', left(coalesce(new.description, ''), 20000)), 'D');
  return new;
end;
$$;

drop trigger if exists internships_search_vector on public.internships;
create trigger internships_search_vector
  before insert or update of title, company_name, skills, city, state, description
  on public.internships
  for each row execute function public.set_internship_search_vector();

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();

drop trigger if exists companies_touch on public.companies;
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();

drop trigger if exists internship_profiles_touch on public.internship_profiles;
create trigger internship_profiles_touch before update on public.internship_profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Company upsert + skill fan-out on every internship write
-- ---------------------------------------------------------------------
create or replace function public.sync_internship_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_company_id uuid;
begin
  insert into public.companies (slug, name, website, domain, logo_url)
  values (new.company_slug, new.company_name, new.company_website, new.company_domain, new.company_logo_url)
  on conflict (slug) do update
    set name     = excluded.name,
        website  = coalesce(public.companies.website, excluded.website),
        domain   = coalesce(public.companies.domain, excluded.domain),
        logo_url = coalesce(public.companies.logo_url, excluded.logo_url)
  returning id into resolved_company_id;

  new.company_id := resolved_company_id;
  return new;
end;
$$;

drop trigger if exists internships_sync_company on public.internships;
create trigger internships_sync_company before insert or update of company_slug, company_name
  on public.internships
  for each row execute function public.sync_internship_company();

create or replace function public.fan_out_internship_skills()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.internship_skills where internship_id = new.id;

  insert into public.internship_skills (internship_id, skill)
  select new.id, unnest(new.skills)
  on conflict do nothing;

  if new.company_id is not null then
    insert into public.company_skills (company_id, skill, count)
    select new.company_id, unnest(new.skills), 1
    on conflict (company_id, skill) do update set count = public.company_skills.count + 1;

    update public.companies
       set posting_count = (select count(*) from public.internships
                             where company_id = new.company_id and is_active)
     where id = new.company_id;
  end if;

  return new;
end;
$$;

drop trigger if exists internships_fan_out_skills on public.internships;
create trigger internships_fan_out_skills after insert or update of skills, company_id
  on public.internships
  for each row execute function public.fan_out_internship_skills();

-- ---------------------------------------------------------------------
-- Atomic counters
-- ---------------------------------------------------------------------
create or replace function public.increment_internship_counter(internship_id uuid, counter text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if counter = 'view_count' then
    update public.internships set view_count = view_count + 1 where id = internship_id;
  elsif counter = 'apply_count' then
    update public.internships set apply_count = apply_count + 1 where id = internship_id;
  else
    raise exception 'Unsupported counter: %', counter;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Vector search
-- ---------------------------------------------------------------------
create or replace function public.match_internships(
  query_embedding    vector(768),
  match_count        integer default 20,
  filter_country     text default null,
  filter_work_modes  text[] default null,
  filter_min_stipend numeric default null,
  filter_active_only boolean default true
)
returns table (
  id uuid, fingerprint text, title text, normalized_title text,
  company_id uuid, company_name text, company_slug text, company_website text,
  company_logo_url text, company_domain text,
  city text, state text, country char(2), location_raw text,
  work_mode work_mode, employment_type employment_type,
  stipend_min numeric, stipend_max numeric, stipend_currency text, stipend_period text,
  is_unpaid boolean, stipend_monthly_inr numeric, stipend_raw text,
  duration_months numeric, duration_raw text,
  skills text[], degrees text[], branches text[], eligible_years integer[],
  min_cgpa numeric, eligibility_notes text[],
  description text, description_html text, apply_url text,
  posted_at timestamptz, deadline_at timestamptz, tags text[],
  sources jsonb, source_confidence real,
  is_active boolean, view_count integer, apply_count integer, quality_score real,
  embedding vector(768), search_vector tsvector, created_at timestamptz, updated_at timestamptz,
  similarity real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select i.*, (1 - (i.embedding <=> query_embedding))::real as similarity
    from public.internships i
   where i.embedding is not null
     and (not filter_active_only or i.is_active)
     and (filter_country is null or i.country = filter_country)
     and (filter_work_modes is null or i.work_mode::text = any(filter_work_modes))
     and (filter_min_stipend is null or i.stipend_monthly_inr >= filter_min_stipend)
   order by i.embedding <=> query_embedding
   limit greatest(1, least(match_count, 100));
$$;

-- ---------------------------------------------------------------------
-- Analytics views
-- ---------------------------------------------------------------------
create or replace view public.v_most_viewed_internships as
  select id, title, company_name, view_count as count
    from public.internships
   where is_active
   order by view_count desc
   limit 50;

create or replace view public.v_trending_companies as
  select c.id, c.name as company_name, count(i.id)::int as count
    from public.companies c
    join public.internships i on i.company_id = c.id
   where i.is_active and i.posted_at > now() - interval '30 days'
   group by c.id, c.name
   order by count desc
   limit 50;

create or replace view public.v_trending_roles as
  select normalized_title, count(*)::int as count
    from public.internships
   where is_active and posted_at > now() - interval '30 days'
   group by normalized_title
   order by count desc
   limit 50;

create or replace view public.v_popular_skills as
  select s.skill, count(*)::int as count
    from public.internship_skills s
    join public.internships i on i.id = s.internship_id
   where i.is_active
   group by s.skill
   order by count desc
   limit 100;

create or replace view public.v_conversion_funnel as
  select
    (select coalesce(sum(view_count), 0) from public.internships)                       as views,
    (select count(*) from public.applications where status <> 'saved')                  as applications,
    (select count(*) from public.applications where status in ('offer','accepted'))     as offers;

create or replace view public.v_provider_health as
  select p.key, p.status, p.reachable, p.latency_ms, p.consecutive_failures, p.checked_at,
         (select max(finished_at) from public.sync_logs l
           where l.provider = p.key and l.status = 'success')                           as last_success_at,
         (select count(*) from public.sync_logs l
           where l.provider = p.key and l.started_at > now() - interval '24 hours')::int as runs_24h
    from public.providers p;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.internships             enable row level security;
alter table public.companies               enable row level security;
alter table public.internship_skills       enable row level security;
alter table public.company_skills          enable row level security;
alter table public.providers               enable row level security;
alter table public.sync_logs               enable row level security;
alter table public.internship_profiles     enable row level security;
alter table public.saved_internships       enable row level security;
alter table public.applications            enable row level security;
alter table public.recommendations         enable row level security;
alter table public.notifications           enable row level security;
alter table public.notification_preferences enable row level security;

-- Public catalogue: readable by any signed-in user, writable only by the service role.
drop policy if exists internships_read on public.internships;
create policy internships_read on public.internships
  for select to authenticated using (true);

drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies
  for select to authenticated using (true);

drop policy if exists internship_skills_read on public.internship_skills;
create policy internship_skills_read on public.internship_skills
  for select to authenticated using (true);

drop policy if exists company_skills_read on public.company_skills;
create policy company_skills_read on public.company_skills
  for select to authenticated using (true);

drop policy if exists providers_read on public.providers;
create policy providers_read on public.providers
  for select to authenticated using (true);

-- sync_logs and analytics stay service-role only: no policy is created,
-- so RLS denies every request that is not made with the service key.

-- Per-user data.
drop policy if exists internship_profiles_own on public.internship_profiles;
create policy internship_profiles_own on public.internship_profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists saved_internships_own on public.saved_internships;
create policy saved_internships_own on public.saved_internships
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists applications_own on public.applications;
create policy applications_own on public.applications
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists recommendations_own_read on public.recommendations;
create policy recommendations_own_read on public.recommendations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Seed the provider registry rows the engine expects
-- ---------------------------------------------------------------------
insert into public.providers (key, label, status) values
  ('greenhouse','Greenhouse Job Boards','unconfigured'),
  ('lever','Lever Postings','unconfigured'),
  ('ashby','Ashby Job Board','unconfigured'),
  ('adzuna','Adzuna','unconfigured'),
  ('jooble','Jooble','unconfigured'),
  ('themuse','The Muse','active'),
  ('remotive','Remotive','active'),
  ('remoteok','Remote OK','active'),
  ('weworkremotely','We Work Remotely','active'),
  ('arbeitnow','Arbeitnow','active')
on conflict (key) do nothing;
