-- ============================================================================
-- PROPHEZY — 0027_quiz_questions_embedding.sql
-- Purpose : Embedding column for semantic question search. Mirrors
--           document_chunks.embedding (0006) — 768 dims for Gemini
--           text-embedding-004, populated async after question generation
--           by search.service.ts#embedQuestion, same pattern as chunk embed.
-- Depends : 0001_extensions.sql (vector), 0022_quiz_engine_extend.sql
-- ============================================================================

alter table public.quiz_questions
  add column if not exists embedding extensions.vector(768);

create index if not exists quiz_questions_embedding_idx
  on public.quiz_questions
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

comment on column public.quiz_questions.embedding is
  'Null until search.service.ts#embedQuestion runs (async, post-generation). Used for semantic/concept search via cosine similarity.';
