-- Blog schema for Prophezy marketing blog.
-- Run with: supabase db push   (or paste into the SQL editor in the dashboard)

create extension if not exists "pgcrypto";

create table if not exists blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists blog_tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null,
  content_markdown text not null,
  cover_image_url text,
  category_id uuid references blog_categories(id) on delete set null,
  author_name text not null,
  author_avatar_url text,
  read_time_minutes integer not null default 5,
  is_featured boolean not null default false,
  status text not null default 'published' check (status in ('draft', 'published')),
  view_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blog_post_tags (
  post_id uuid not null references blog_posts(id) on delete cascade,
  tag_id uuid not null references blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

-- One row per view event; kept separate from blog_posts.view_count so
-- "popular this week/month" can be computed later without extra columns.
create table if not exists blog_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists blog_posts_status_published_at_idx on blog_posts (status, published_at desc);
create index if not exists blog_posts_category_id_idx on blog_posts (category_id);
create index if not exists blog_posts_view_count_idx on blog_posts (view_count desc);
create index if not exists blog_views_post_id_idx on blog_views (post_id, viewed_at desc);

-- keep updated_at current
create or replace function blog_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blog_posts_set_updated_at on blog_posts;
create trigger blog_posts_set_updated_at
  before update on blog_posts
  for each row
  execute function blog_set_updated_at();

-- Atomic, safe-for-anonymous-clients view increment. Runs as the function
-- owner (security definer) so anonymous visitors can record a view and bump
-- the denormalized counter without needing UPDATE/INSERT grants directly.
create or replace function increment_blog_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  select id into v_post_id from blog_posts where slug = p_slug and status = 'published';
  if v_post_id is null then
    return;
  end if;
  insert into blog_views (post_id) values (v_post_id);
  update blog_posts set view_count = view_count + 1 where id = v_post_id;
end;
$$;

grant execute on function increment_blog_view(text) to anon, authenticated;

-- RLS: published content is publicly readable; writes are service-role only
-- (i.e. done from the server, never from the browser).
alter table blog_categories enable row level security;
alter table blog_tags enable row level security;
alter table blog_posts enable row level security;
alter table blog_post_tags enable row level security;
alter table blog_views enable row level security;

drop policy if exists "public read categories" on blog_categories;
create policy "public read categories" on blog_categories for select using (true);

drop policy if exists "public read tags" on blog_tags;
create policy "public read tags" on blog_tags for select using (true);

drop policy if exists "public read published posts" on blog_posts;
create policy "public read published posts" on blog_posts
  for select using (status = 'published');

drop policy if exists "public read post_tags" on blog_post_tags;
create policy "public read post_tags" on blog_post_tags for select using (true);

-- blog_views has no select/insert policy for anon — all writes to it go
-- through increment_blog_view(), which runs as security definer and bypasses
-- RLS deliberately. This keeps raw view-event rows non-readable/writable
-- directly from the browser.
