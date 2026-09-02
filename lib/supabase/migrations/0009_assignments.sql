-- ============================================================================
-- PROPHEZY — 0009_assignments.sql
-- Purpose : Generated assignments (free-response questions) and quizzes
--           (MCQs). Backs generation kinds 'assignment', 'quiz', 'mcqs'.
-- Depends : 0002_enums.sql, 0007_notes.sql (generations)
-- ============================================================================

create table public.assignments (
  id            uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  instructions  text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (generation_id)
);

create table public.assignment_questions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  position      integer not null default 0,
  question_text text not null,
  marks         smallint not null default 1,
  created_at    timestamptz not null default now()
);

create table public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  title         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (generation_id)
);

create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes (id) on delete cascade,
  position       integer not null default 0,
  question_text  text not null,
  options        jsonb not null,        -- [{ "key": "A", "text": "..." }, ...]
  correct_option text not null,
  explanation    text,
  created_at     timestamptz not null default now()
);

comment on table public.quizzes is
  'Backs generation kinds ''quiz'' and ''mcqs''.';
comment on table public.quiz_questions is
  'options is a JSON array of {key, text}; correct_option matches one option key.';
