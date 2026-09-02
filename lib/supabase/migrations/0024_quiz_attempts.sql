-- ============================================================================
-- PROPHEZY — 0024_quiz_attempts.sql
-- Purpose : One row per time a user takes a quiz (quiz_attempts), and one
--           row per question answered within that attempt (quiz_responses).
--           This is the data analytics.service.ts, grading.service.ts, and
--           leaderboard.service.ts all read from.
-- Depends : 0009_assignments.sql, 0022_quiz_engine_extend.sql, 0023_quiz_topics.sql
-- ============================================================================

create table public.quiz_attempts (
  id                uuid primary key default gen_random_uuid(),
  quiz_id           uuid not null references public.quizzes (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  status            public.quiz_attempt_status not null default 'in_progress',
  started_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  time_taken_sec    integer,
  raw_score         numeric(6, 2),          -- sum of marks awarded, before negative marking
  final_score       numeric(6, 2),          -- after negative marking applied
  max_score         numeric(6, 2) not null default 0,
  accuracy_pct      numeric(5, 2),          -- correct / attempted, not correct / total
  completion_pct    numeric(5, 2) not null default 0,
  is_adaptive_run   boolean not null default false,
  next_difficulty   public.quiz_difficulty, -- adaptive.service.ts writes its next suggestion here
  created_at        timestamptz not null default now()
);

comment on table public.quiz_attempts is
  'One row per quiz-taking session. raw_score/final_score/accuracy_pct/completion_pct are computed by grading.service.ts on submit; left null while status = in_progress.';

create table public.quiz_responses (
  id                uuid primary key default gen_random_uuid(),
  attempt_id        uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id       uuid not null references public.quiz_questions (id) on delete cascade,
  -- Free-form: string for text-shaped answers, string[] for multi-select /
  -- ordering, {left,right}[] for match_following, code string for
  -- programming/sql/debugging. Shape mirrors quiz_questions.metadata.
  response          jsonb not null default 'null'::jsonb,
  is_correct        boolean,               -- null until graded
  marks_awarded     numeric(5, 2),
  ai_feedback       text,                  -- populated for grading_method = 'ai_graded'
  time_spent_sec    integer,
  hint_used         boolean not null default false,
  answered_at       timestamptz not null default now(),

  unique (attempt_id, question_id)
);

comment on table public.quiz_responses is
  'One row per question per attempt. is_correct/marks_awarded/ai_feedback are null until grading.service.ts processes the response (immediate for exact_match/set_match, async via runStructured for ai_graded).';

create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, status);
create index if not exists quiz_responses_attempt_idx on public.quiz_responses (attempt_id);
create index if not exists quiz_responses_question_idx on public.quiz_responses (question_id);
