-- ============================================================================
-- PROPHEZY — 0022_quiz_engine_extend.sql
-- Purpose : Extend the existing `quizzes` / `quiz_questions` tables (0009)
--           with the columns the Quiz Intelligence Engine needs. All new
--           columns are nullable or have safe defaults, so every existing
--           row (plain MCQ, options as [{key,text}]) remains valid without
--           a backfill. No existing column is dropped, renamed, or retyped.
-- Depends : 0009_assignments.sql, 0021_quiz_engine_enums.sql
-- ============================================================================

-- ---- quizzes -----------------------------------------------------------

alter table public.quizzes
  add column if not exists exam_mode        public.quiz_exam_mode not null default 'practice',
  add column if not exists difficulty       public.quiz_difficulty not null default 'medium',
  add column if not exists is_adaptive      boolean not null default false,
  add column if not exists time_limit_sec   integer,                 -- null = untimed
  add column if not exists negative_marking numeric(4, 2) not null default 0, -- e.g. 0.25 = -1/4 per wrong answer
  add column if not exists topic_ids        uuid[] not null default '{}',
  add column if not exists source_upload_id uuid references public.uploads (id) on delete set null,
  add column if not exists question_count   integer not null default 0;

comment on column public.quizzes.negative_marking is
  'Fraction of a question''s marks deducted for a wrong answer. 0 disables negative marking.';
comment on column public.quizzes.topic_ids is
  'Denormalized array of public.quiz_topics.id covered by this quiz, for fast topic-weightage queries without a join.';

-- ---- quiz_questions ------------------------------------------------------

alter table public.quiz_questions
  add column if not exists question_type   public.quiz_question_type not null default 'mcq',
  add column if not exists grading_method  public.quiz_grading_method not null default 'exact_match',
  add column if not exists difficulty      public.quiz_difficulty not null default 'medium',
  add column if not exists marks           smallint not null default 1,
  add column if not exists hint            text,
  add column if not exists step_solution   text,
  add column if not exists topic_id        uuid,
  add column if not exists concept_tags    text[] not null default '{}',
  -- Type-specific payload. Shape depends on question_type:
  --   match_following: { pairs: [{ left, right }] }
  --   ordering:        { items: [string], correctOrder: [number] }
  --   multiple_select: { options: [{key,text}], correctOptions: [string] }
  --   programming/sql/debugging/coding_challenge:
  --                    { language, starterCode?, testCases: [{input, expectedOutput}] }
  --   subject-tagged types (mathematics/physics/.../law/business/ai_ml):
  --                    free-form solution payload, grading_method='ai_graded'
  -- MCQ/true_false/one_word/fill_in_blank/short_answer/long_answer/essay/
  -- case_study keep using the existing `options` + `correct_option` columns
  -- where applicable; `metadata` carries anything those two can't express.
  add column if not exists metadata        jsonb not null default '{}'::jsonb;

comment on column public.quiz_questions.metadata is
  'Type-specific payload keyed off question_type. See lib/quiz/validation/question-schemas.ts for the zod schema per type — that file is the source of truth for this shape.';

-- options/correct_option were NOT NULL in 0009 (assumed every question was
-- MCQ). Relax both: only mcq/multiple_select-shaped rows populate them now;
-- everything else stores its answer key inside `metadata`.
alter table public.quiz_questions
  alter column options drop not null,
  alter column correct_option drop not null;

alter table public.quiz_questions
  add constraint quiz_questions_options_required_for_mcq
  check (
    question_type not in ('mcq', 'multiple_select')
    or (options is not null and correct_option is not null)
    or (question_type = 'multiple_select' and metadata ? 'correctOptions')
  );

create index if not exists quiz_questions_type_idx on public.quiz_questions (question_type);
create index if not exists quiz_questions_topic_idx on public.quiz_questions (topic_id);
create index if not exists quiz_questions_difficulty_idx on public.quiz_questions (difficulty);
create index if not exists quiz_questions_metadata_gin_idx on public.quiz_questions using gin (metadata);

