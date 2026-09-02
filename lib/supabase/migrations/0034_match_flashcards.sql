-- 0034_match_flashcards.sql
-- Adds the pgvector semantic-search RPC that lib/flashcards/services/search.service.ts
-- calls but which was never migrated. Mirrors the match_document_chunks /
-- match_humanizer_history pattern. flashcards.embedding is vector(768)
-- (text-embedding-004); deck_id is uuid.

create or replace function public.match_flashcards(
  query_embedding vector(768),
  match_deck_id uuid default null,
  match_limit int default 20
)
returns setof public.flashcards
language sql
stable
as $$
  select *
  from public.flashcards
  where (match_deck_id is null or deck_id = match_deck_id)
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_limit;
$$;
