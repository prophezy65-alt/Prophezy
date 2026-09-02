-- ============================================================================
-- PROPHEZY — 0002_interview.sql
-- Purpose : Tables for the Interview Intelligence Engine. Purely additive —
--           does not alter any existing table, type, or policy.
-- Depends : 0001_extensions.sql (pgcrypto for gen_random_uuid, citext)
-- ============================================================================

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  company text,
  interview_type text not null,
  seniority text not null default 'mid',
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists interview_sessions_user_id_idx on public.interview_sessions(user_id);
create index if not exists interview_sessions_status_idx on public.interview_sessions(status);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  order_index int not null,
  question text not null,
  topic text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_type text not null,
  source text not null default 'generic',
  created_at timestamptz not null default now()
);

create index if not exists interview_questions_session_id_idx on public.interview_questions(session_id);

create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.interview_questions(id) on delete cascade,
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  answer_text text not null,
  submitted_at timestamptz not null default now()
);

create index if not exists interview_answers_session_id_idx on public.interview_answers(session_id);
create unique index if not exists interview_answers_question_id_key on public.interview_answers(question_id);

create table if not exists public.interview_evaluations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.interview_answers(id) on delete cascade,
  correctness numeric(4,1) not null,
  communication numeric(4,1) not null,
  technical_depth numeric(4,1) not null,
  confidence numeric(4,1) not null,
  problem_solving numeric(4,1) not null,
  clarity numeric(4,1) not null,
  grammar numeric(4,1) not null,
  completeness numeric(4,1) not null,
  logic numeric(4,1) not null,
  professionalism numeric(4,1) not null,
  overall_score numeric(4,1) not null,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  model_answer text not null default '',
  alternative_answer text not null default '',
  improvement_plan text not null default '',
  suggested_resources text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists interview_evaluations_answer_id_key on public.interview_evaluations(answer_id);

create table if not exists public.interview_skill_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null,
  score numeric(4,1) not null,
  created_at timestamptz not null default now()
);

create index if not exists interview_skill_scores_user_id_idx on public.interview_skill_scores(user_id);
create index if not exists interview_skill_scores_skill_idx on public.interview_skill_scores using gin (skill extensions.gin_trgm_ops);

create table if not exists public.interview_analytics_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_attempts int not null default 0,
  average_score numeric(4,1) not null default 0,
  strong_areas text[] not null default '{}',
  weak_areas text[] not null default '{}',
  last_computed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — users can only read/write their own rows.
-- Child tables (questions/answers/evaluations) check ownership via a join
-- back up to interview_sessions.user_id since they don't carry user_id
-- directly.
-- ---------------------------------------------------------------------------

alter table public.interview_sessions enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_answers enable row level security;
alter table public.interview_evaluations enable row level security;
alter table public.interview_skill_scores enable row level security;
alter table public.interview_analytics_snapshots enable row level security;

create policy interview_sessions_owner on public.interview_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy interview_questions_owner on public.interview_questions
  for all using (
    exists (select 1 from public.interview_sessions s where s.id = session_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.interview_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy interview_answers_owner on public.interview_answers
  for all using (
    exists (select 1 from public.interview_sessions s where s.id = session_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.interview_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy interview_evaluations_owner on public.interview_evaluations
  for all using (
    exists (
      select 1
      from public.interview_answers a
      join public.interview_sessions s on s.id = a.session_id
      where a.id = answer_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.interview_answers a
      join public.interview_sessions s on s.id = a.session_id
      where a.id = answer_id and s.user_id = auth.uid()
    )
  );

create policy interview_skill_scores_owner on public.interview_skill_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy interview_analytics_snapshots_owner on public.interview_analytics_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
