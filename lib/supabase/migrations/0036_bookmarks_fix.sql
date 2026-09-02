-- Run ONLY after confirming row_count = 0 from the diagnostic query above.
-- If it has real rows, stop and send me the column list instead — I'll
-- write an ALTER-based migration that preserves the data.

drop table if exists public.bookmarks cascade;
drop type if exists public.bookmark_item_type cascade;

create type public.bookmark_item_type as enum (
  'internship',
  'research_paper',
  'note',
  'project',
  'resume',
  'quiz',
  'assignment',
  'flashcard_deck'
);

create table public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_type   public.bookmark_item_type not null,
  item_id     uuid not null,
  title       text not null,
  subtitle    text,
  href        text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),

  unique (user_id, item_type, item_id)
);

comment on table public.bookmarks is
  'Denormalized "saved items" across every module. title/subtitle/href are a snapshot at bookmark time, not a live join — item_id has no FK since the target table varies by item_type.';

create index if not exists bookmarks_user_created_idx on public.bookmarks (user_id, created_at desc);
create index if not exists bookmarks_user_type_idx on public.bookmarks (user_id, item_type);
create index if not exists bookmarks_title_trgm_idx on public.bookmarks using gin (title extensions.gin_trgm_ops);

alter table public.bookmarks enable row level security;

create policy bookmarks_owner_all on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
