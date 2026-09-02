-- ============================================================================
-- PROPHEZY — 0028_match_quiz_questions_fn.sql
-- Purpose : RPC used by search.service.ts#semanticSearch. security definer so
--           it can join through to generations.user_id for scoping without
--           requiring the caller to have direct select rights on generations
--           beyond their own RLS-visible rows (it re-checks user_id itself).
-- Depends : 0027_quiz_questions_embedding.sql
-- ============================================================================

create or replace function public.match_quiz_questions(
  query_embedding extensions.vector(768),
  match_user_id   uuid,
  match_count     integer default 20
)
returns table (
  id              uuid,
  quiz_id         uuid,
  "position"      integer,
  question_text   text,
  question_type   public.quiz_question_type,
  grading_method  public.quiz_grading_method,
  difficulty      public.quiz_difficulty,
  marks           smallint,
  options         jsonb,
  correct_option  text,
  hint            text,
  explanation     text,
  step_solution   text,
  topic_id        uuid,
  concept_tags    text[],
  metadata        jsonb,
  created_at      timestamptz,
  similarity      float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    qq.id, qq.quiz_id, qq.position as "position", qq.question_text, qq.question_type,
    qq.grading_method, qq.difficulty, qq.marks, qq.options, qq.correct_option,
    qq.hint, qq.explanation, qq.step_solution, qq.topic_id, qq.concept_tags,
    qq.metadata, qq.created_at,
    1 - (qq.embedding <=> query_embedding) as similarity
  from public.quiz_questions qq
  join public.quizzes qz on qz.id = qq.quiz_id
  join public.generations g on g.id = qz.generation_id
  where g.user_id = match_user_id
    and qq.embedding is not null
  order by qq.embedding <=> query_embedding
  limit match_count;
$$;

comment on function public.match_quiz_questions is
  'Cosine-similarity search over a single user''s quiz questions. security definer to traverse quiz_questions -> quizzes -> generations without requiring broad grants; still filters by match_user_id explicitly.';