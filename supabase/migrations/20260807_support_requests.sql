-- Support form submissions (bug reports + feature requests).
-- Run with: supabase db push   (or paste into the SQL editor in the dashboard)

create extension if not exists "pgcrypto";

create table if not exists support_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bug', 'feature', 'general')),
  email text not null,
  subject text not null,
  message text not null,
  page_url text,
  user_agent text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists support_requests_kind_created_at_idx on support_requests (kind, created_at desc);
create index if not exists support_requests_status_idx on support_requests (status);

alter table support_requests enable row level security;

-- No direct client access at all — every write and read goes through the
-- /api/support route using the service-role key, so submissions can't be
-- read or spammed directly against the table from the browser.
drop policy if exists "no client access" on support_requests;
create policy "no client access" on support_requests for all using (false) with check (false);
