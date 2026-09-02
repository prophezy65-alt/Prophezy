create extension if not exists vector;
create extension if not exists pgcrypto;

drop table if exists public.document_chunks cascade;

create table public.documents (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null,
  owner_module         text,
  filename             text not null,
  format               text not null,
  status               text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  metadata             jsonb not null default '{}'::jsonb,
  summary              text,
  language             text,
  reading_time_minutes integer,
  error_message        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  processed_at         timestamptz
);

create index documents_user_idx on public.documents (user_id, created_at desc);
create index documents_owner_module_idx on public.documents (owner_module);
create index documents_status_idx on public.documents (status);

create table public.document_metadata (
  document_id     uuid primary key references public.documents (id) on delete cascade,
  title           text,
  subtitle        text,
  authors         text[] not null default '{}',
  institution     text,
  created_date    date,
  modified_date   date,
  page_count      integer not null default 0,
  word_count      integer not null default 0,
  file_size_bytes bigint not null default 0,
  mime_type       text not null default '',
  has_toc         boolean not null default false,
  has_bookmarks   boolean not null default false,
  custom          jsonb not null default '{}'::jsonb
);

create index document_metadata_title_idx on public.document_metadata using gin (to_tsvector('english', coalesce(title, '')));

create table public.document_chunks (
  id               text primary key,
  document_id      uuid not null references public.documents (id) on delete cascade,
  chunk_index      integer not null,
  text             text not null,
  strategy         text not null check (strategy in ('recursive', 'semantic', 'sliding_window')),
  start_page_index integer not null default 0,
  end_page_index   integer not null default 0,
  token_estimate   integer not null default 0,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunks_document_idx on public.document_chunks (document_id);
create index document_chunks_text_fts_idx on public.document_chunks using gin (to_tsvector('english', text));

create table public.document_embeddings (
  chunk_id   text primary key references public.document_chunks (id) on delete cascade,
  embedding  vector(768) not null,
  model      text not null default 'gemini-embedding',
  dimensions integer not null default 768,
  created_at timestamptz not null default now()
);

create index document_embeddings_vector_idx
  on public.document_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table public.document_search_index (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  kind        text not null check (kind in ('page', 'section', 'topic')),
  ref_id      text,
  page_index  integer,
  text        text not null,
  weight      numeric(4, 3) not null default 1.0,
  created_at  timestamptz not null default now()
);

create index document_search_index_document_idx on public.document_search_index (document_id, kind);
create index document_search_index_fts_idx on public.document_search_index using gin (to_tsvector('english', text));

create table public.document_analytics (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  event       text not null,
  duration_ms integer,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index document_analytics_document_idx on public.document_analytics (document_id, created_at);
create index document_analytics_event_idx on public.document_analytics (event, created_at desc);

create table public.processed_files (
  content_hash text primary key,
  document_id  uuid not null references public.documents (id) on delete cascade,
  storage_ref  text,
  size_bytes   bigint not null,
  mime_type    text not null,
  created_at   timestamptz not null default now()
);

create index processed_files_document_idx on public.processed_files (document_id);

create or replace function match_document_chunks(
  query_embedding vector(768),
  match_document_id uuid default null,
  match_limit int default 20
)
returns table (
  id text,
  document_id uuid,
  text text,
  start_page_index integer,
  similarity float
)
language sql stable
as $func$
  select
    c.id,
    c.document_id,
    c.text,
    c.start_page_index,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.document_embeddings e on e.chunk_id = c.id
  where (match_document_id is null or c.document_id = match_document_id)
  order by e.embedding <=> query_embedding
  limit match_limit;
$func$;