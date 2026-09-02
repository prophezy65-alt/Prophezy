-- ============================================================================
-- PROPHEZY - 0033_humanizer.sql
-- Purpose : Humanizer feature tables. Derived from lib/humanizer/services/*.
--           history.service.ts, analytics.service.ts, search.service.ts all
--           read/write these; they were referenced in code but never migrated.
-- Depends : 0001_extensions.sql (vector, pg_trgm), auth.users
-- ============================================================================

-- ---------------------------------------------------------------------------
-- humanizer_history: one row per saved rewrite.
-- ---------------------------------------------------------------------------
create table if not exists public.humanizer_history (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  rewrite_id           uuid not null,
  original_text        text not null,
  rewritten_text       text not null,
  style                text not null,
  tone                 text,
  domain               text,
  grammar_score_before real,
  grammar_score_after  real,
  readability_before   real,
  readability_after    real,
  changes_summary      text,
  embedding            extensions.vector(768),
  created_at           timestamptz not null default now()
);

create index if not exists humanizer_history_user_idx
  on public.humanizer_history (user_id, created_at desc);

create index if not exists humanizer_history_rewrite_idx
  on public.humanizer_history (rewrite_id);

-- full-text search over rewritten_text (search.service.ts keyword mode)
create index if not exists humanizer_history_text_fts_idx
  on public.humanizer_history using gin (to_tsvector('english', rewritten_text));

-- pgvector semantic search (search.service.ts semantic mode)
create index if not exists humanizer_history_embedding_idx
  on public.humanizer_history using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------------
-- humanizer_analytics: append-only event log (analytics.service.ts).
-- ---------------------------------------------------------------------------
create table if not exists public.humanizer_analytics (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  rewrite_id uuid,
  event_type text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists humanizer_analytics_user_idx
  on public.humanizer_analytics (user_id, created_at desc);

create index if not exists humanizer_analytics_event_idx
  on public.humanizer_analytics (event_type, created_at desc);

-- ---------------------------------------------------------------------------
-- match_humanizer_history: pgvector cosine-similarity RPC.
-- search.service.ts calls: match_humanizer_history(query_embedding,
-- match_user_id, match_count) and reads rewrite_id, rewritten_text,
-- similarity, created_at.
-- ---------------------------------------------------------------------------
create or replace function match_humanizer_history(
  query_embedding extensions.vector(768),
  match_user_id uuid,
  match_count int default 20
)
returns table (
  rewrite_id uuid,
  rewritten_text text,
  similarity float,
  created_at timestamptz
)
language sql stable
as $func$
  select
    h.rewrite_id,
    h.rewritten_text,
    1 - (h.embedding <=> query_embedding) as similarity,
    h.created_at
  from public.humanizer_history h
  where h.user_id = match_user_id
    and h.embedding is not null
  order by h.embedding <=> query_embedding
  limit match_count;
$func$;