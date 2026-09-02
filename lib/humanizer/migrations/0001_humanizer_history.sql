-- lib/humanizer/migrations/0001_humanizer_history.sql
--
-- Copy into your real supabase/migrations/ directory with the correct next
-- sequence number for your project (this module doesn't know your current
-- migration count — see the existing supabase/migrations/00XX_*.sql files
-- for the next available number).
--
-- Introduces ONE new table. Does not modify any existing table.

create extension if not exists vector;

create table if not exists public.humanizer_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rewrite_id uuid not null,
  original_text text not null,
  rewritten_text text not null,
  style text not null check (style in (
    'humanize', 'academic', 'professional', 'student', 'business',
    'seo', 'email', 'cover_letter', 'resume_bullet'
  )),
  tone text check (tone in ('formal', 'casual', 'friendly', 'technical')),
  domain text not null default 'general' check (domain in (
    'research_paper', 'assignment', 'notes', 'resume', 'cover_letter',
    'email', 'blog_post', 'report', 'general'
  )),
  grammar_score_before smallint,
  grammar_score_after smallint,
  readability_before real,
  readability_after real,
  changes_summary text,
  -- text-embedding-004 (or your configured Gemini embedding model) dimension.
  -- Adjust the dimension to match whatever model lib/ai/engine.ts's embed()
  -- actually uses if it differs from 768.
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists humanizer_history_user_id_idx on public.humanizer_history (user_id);
create index if not exists humanizer_history_created_at_idx on public.humanizer_history (created_at desc);
create index if not exists humanizer_history_style_idx on public.humanizer_history (style);

-- Full-text search index for keyword search (search.service.ts's keywordSearch)
create index if not exists humanizer_history_rewritten_text_fts_idx
  on public.humanizer_history using gin (to_tsvector('english', rewritten_text));

-- Approximate nearest-neighbor index for semantic search (search.service.ts's semanticSearch)
create index if not exists humanizer_history_embedding_idx
  on public.humanizer_history using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.humanizer_history enable row level security;

create policy "Users can view their own humanizer history"
  on public.humanizer_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own humanizer history"
  on public.humanizer_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own humanizer history"
  on public.humanizer_history for delete
  using (auth.uid() = user_id);

-- RPC used by search.service.ts's semanticSearch() for cosine-similarity matching
create or replace function match_humanizer_history(
  query_embedding vector(768),
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
as $$
  select
    rewrite_id,
    rewritten_text,
    1 - (embedding <=> query_embedding) as similarity,
    created_at
  from public.humanizer_history
  where user_id = match_user_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
