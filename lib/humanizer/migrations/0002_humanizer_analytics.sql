-- lib/humanizer/migrations/0002_humanizer_analytics.sql
-- Copy into supabase/migrations/ with the correct next sequence number,
-- AFTER 0001_humanizer_history.sql.

create table if not exists public.humanizer_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rewrite_id uuid,
  event_type text not null check (event_type in (
    'rewrite_requested', 'rewrite_completed', 'grammar_check',
    'readability_check', 'export', 'search'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists humanizer_analytics_user_id_idx on public.humanizer_analytics (user_id);
create index if not exists humanizer_analytics_event_type_idx on public.humanizer_analytics (event_type);
create index if not exists humanizer_analytics_created_at_idx on public.humanizer_analytics (created_at desc);

alter table public.humanizer_analytics enable row level security;

create policy "Users can view their own humanizer analytics"
  on public.humanizer_analytics for select
  using (auth.uid() = user_id);

create policy "Service role can insert humanizer analytics"
  on public.humanizer_analytics for insert
  with check (true); -- inserts happen via the admin client from analytics.service.ts, not user session
