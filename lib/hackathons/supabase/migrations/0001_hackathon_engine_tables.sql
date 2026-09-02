-- ============================================================
-- Hackathon Intelligence Engine — persistence layer
-- ============================================================
-- ADDITIVE ONLY. Creates NEW tables for the Hackathon module.
-- Does not alter, drop, or rename any existing table, column,
-- or policy from other modules. Run via `supabase db push` or
-- the Supabase SQL editor.
-- ============================================================

create extension if not exists vector;

-- Normalized hackathons synced from all source providers.
create table if not exists public.hackathons (
  id text primary key,
  source_id text not null,
  source_url text not null,
  title text not null,
  description text not null,
  organizer jsonb not null,
  mode text not null check (mode in ('online', 'offline', 'hybrid')),
  location text,
  country text,
  themes text[] not null default '{}',
  technologies text[] not null default '{}',
  eligibility text[] not null default '{}',
  experience_tier text[] not null default '{}',
  timeline jsonb not null,
  prizes jsonb not null,
  rules_summary text,
  evaluation_criteria text[],
  submission_requirements text[],
  team_size_min integer,
  team_size_max integer,
  fetched_at timestamptz not null default now(),
  raw_source_hash text not null
);

create index if not exists hackathons_source_idx on public.hackathons(source_id);
create index if not exists hackathons_deadline_idx on public.hackathons(((timeline->>'submissionDeadline')));

-- Reference/catalog data — readable by any authenticated user, writable
-- only via service role (the provider sync job).
alter table public.hackathons enable row level security;

drop policy if exists "hackathons_select_all" on public.hackathons;
create policy "hackathons_select_all" on public.hackathons
  for select using (auth.role() = 'authenticated');

-- Registry of source providers and their last sync status.
create table if not exists public.hackathon_providers (
  source_id text primary key,
  display_name text not null,
  is_implemented boolean not null default false,
  last_synced_at timestamptz,
  last_sync_ok boolean,
  last_sync_error text,
  last_fetched_count integer default 0
);

alter table public.hackathon_providers enable row level security;

drop policy if exists "hackathon_providers_select_all" on public.hackathon_providers;
create policy "hackathon_providers_select_all" on public.hackathon_providers
  for select using (auth.role() = 'authenticated');

-- Saved hackathons (bookmarks) per user.
create table if not exists public.saved_hackathons (
  user_id uuid not null references auth.users(id) on delete cascade,
  hackathon_id text not null references public.hackathons(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, hackathon_id)
);

alter table public.saved_hackathons enable row level security;

drop policy if exists "saved_hackathons_own" on public.saved_hackathons;
create policy "saved_hackathons_own" on public.saved_hackathons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tracking entries: status + prep/submission progress per user per hackathon.
create table if not exists public.hackathon_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hackathon_id text not null references public.hackathons(id) on delete cascade,
  status text not null check (status in ('saved', 'registered', 'in_progress', 'submitted', 'completed', 'withdrawn')),
  preparation_progress_percent integer not null default 0,
  submission_progress_percent integer not null default 0,
  notes text,
  updated_at timestamptz not null default now(),
  unique (user_id, hackathon_id)
);

create index if not exists hackathon_registrations_user_idx on public.hackathon_registrations(user_id);

alter table public.hackathon_registrations enable row level security;

drop policy if exists "hackathon_registrations_own" on public.hackathon_registrations;
create policy "hackathon_registrations_own" on public.hackathon_registrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notifications queued for a user.
create table if not exists public.hackathon_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hackathon_id text not null references public.hackathons(id) on delete cascade,
  type text not null check (type in ('new_hackathon', 'deadline_reminder', 'registration_reminder', 'submission_reminder', 'theme_match', 'technology_match')),
  message text not null,
  trigger_at timestamptz not null default now(),
  sent boolean not null default false
);

create index if not exists hackathon_notifications_user_pending_idx
  on public.hackathon_notifications(user_id) where sent = false;

alter table public.hackathon_notifications enable row level security;

drop policy if exists "hackathon_notifications_own" on public.hackathon_notifications;
create policy "hackathon_notifications_own" on public.hackathon_notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cached AI recommendations per user (avoid re-generating every request).
create table if not exists public.hackathon_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hackathon_id text not null references public.hackathons(id) on delete cascade,
  confidence_score integer not null,
  rationale text not null,
  match_score jsonb not null,
  generated_at timestamptz not null default now()
);

create index if not exists hackathon_recommendations_user_idx on public.hackathon_recommendations(user_id);

alter table public.hackathon_recommendations enable row level security;

drop policy if exists "hackathon_recommendations_own" on public.hackathon_recommendations;
create policy "hackathon_recommendations_own" on public.hackathon_recommendations
  for select using (auth.uid() = user_id);

-- Preparation/submission progress snapshots (checklist state, timeline).
create table if not exists public.hackathon_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  hackathon_id text not null references public.hackathons(id) on delete cascade,
  checklist jsonb,
  preparation_timeline jsonb,
  submission jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, hackathon_id)
);

alter table public.hackathon_progress enable row level security;

drop policy if exists "hackathon_progress_own" on public.hackathon_progress;
create policy "hackathon_progress_own" on public.hackathon_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vector embeddings for semantic search.
create table if not exists public.hackathon_search_embeddings (
  id text not null,
  domain text not null check (domain in ('hackathon', 'technology', 'theme', 'organizer', 'company')),
  content text not null,
  embedding vector(768),
  updated_at timestamptz not null default now(),
  primary key (domain, id)
);

create index if not exists hackathon_search_embeddings_vector_idx
  on public.hackathon_search_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.hackathon_search_embeddings enable row level security;

drop policy if exists "hackathon_search_embeddings_select_all" on public.hackathon_search_embeddings;
create policy "hackathon_search_embeddings_select_all" on public.hackathon_search_embeddings
  for select using (auth.role() = 'authenticated');
