-- Blog platform expansion: authors, likes, weekly trending, newsletter.
-- Run AFTER 20260807_blog_schema.sql and its seed.

create extension if not exists "pgcrypto";

-- ── Authors ────────────────────────────────────────────────────────────
create table if not exists blog_authors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table blog_posts add column if not exists author_id uuid references blog_authors(id);

insert into blog_authors (slug, name, bio)
values ('prophezy-team', 'Prophezy Team', 'The team building Prophezy — writing what we wish we''d known as students.')
on conflict (slug) do nothing;

update blog_posts set author_id = (select id from blog_authors where slug = 'prophezy-team')
where author_id is null;

-- ── Likes (anonymous, device-scoped so one browser can't spam) ──────────
create table if not exists blog_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  unique (post_id, device_id)
);

create index if not exists blog_likes_post_id_idx on blog_likes (post_id);

alter table blog_likes enable row level security;
drop policy if exists "no direct client access" on blog_likes;
create policy "no direct client access" on blog_likes for all using (false) with check (false);

create or replace function toggle_blog_like(p_slug text, p_device_id text)
returns table (liked boolean, like_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
  v_existing uuid;
begin
  select id into v_post_id from blog_posts where slug = p_slug and status = 'published';
  if v_post_id is null then
    return query select false, 0;
    return;
  end if;

  select id into v_existing from blog_likes where post_id = v_post_id and device_id = p_device_id;

  if v_existing is null then
    insert into blog_likes (post_id, device_id) values (v_post_id, p_device_id);
  else
    delete from blog_likes where id = v_existing;
  end if;

  return query
    select (v_existing is null), (select count(*)::int from blog_likes where post_id = v_post_id);
end;
$$;

grant execute on function toggle_blog_like(text, text) to anon, authenticated;

create or replace function get_blog_like_state(p_slug text, p_device_id text)
returns table (liked boolean, like_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  select id into v_post_id from blog_posts where slug = p_slug and status = 'published';
  if v_post_id is null then
    return query select false, 0;
    return;
  end if;
  return query
    select
      exists(select 1 from blog_likes where post_id = v_post_id and device_id = p_device_id),
      (select count(*)::int from blog_likes where post_id = v_post_id);
end;
$$;

grant execute on function get_blog_like_state(text, text) to anon, authenticated;

-- ── Trending / popular this week ─────────────────────────────────────────
create or replace function trending_post_slugs(p_limit integer default 5)
returns table (slug text, views_7d integer)
language sql
stable
as $$
  select p.slug, count(v.id)::int as views_7d
  from blog_posts p
  join blog_views v on v.post_id = p.id
  where p.status = 'published' and v.viewed_at > now() - interval '7 days'
  group by p.slug
  order by views_7d desc
  limit p_limit;
$$;

grant execute on function trending_post_slugs(integer) to anon, authenticated;

-- ── Newsletter ────────────────────────────────────────────────────────────
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table newsletter_subscribers enable row level security;
drop policy if exists "no direct client access" on newsletter_subscribers;
create policy "no direct client access" on newsletter_subscribers for all using (false) with check (false);

-- ── New categories for the expanded taxonomy ─────────────────────────────
insert into blog_categories (slug, name, description) values
  ('machine-learning', 'Machine Learning', 'Models, training, and applied ML.'),
  ('data-science', 'Data Science', 'Data analysis, statistics, and analyst careers.'),
  ('python', 'Python', 'Python language fundamentals and practice.'),
  ('web-development', 'Web Development', 'Frontend, backend, and full-stack development.'),
  ('placements', 'Placements', 'Campus placements and hiring processes.'),
  ('career-guidance', 'Career Guidance', 'General career planning and decision-making.'),
  ('github', 'GitHub', 'Version control and building a public dev profile.'),
  ('interview-preparation', 'Interview Preparation', 'Technical and behavioral interview prep.'),
  ('productivity', 'Productivity', 'Time management and study systems.'),
  ('college-life', 'College Life', 'Navigating college beyond academics.'),
  ('research', 'Research', 'Academic research and paper writing.')
on conflict (slug) do update set name = excluded.name, description = excluded.description;
