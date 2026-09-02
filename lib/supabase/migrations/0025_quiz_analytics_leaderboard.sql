-- ============================================================================
-- PROPHEZY — 0025_quiz_analytics_leaderboard.sql
-- Purpose : Per-user, per-topic mastery rollups; leaderboard rankings
--           (global/subject/weekly); daily streaks; badges; question review
--           flags ("mark for review", report a bad question).
-- Depends : 0003_profiles.sql, 0023_quiz_topics.sql, 0024_quiz_attempts.sql
-- ============================================================================

-- ---- mastery / weak-strong topic tracking --------------------------------

create table public.quiz_topic_mastery (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  topic_id       uuid not null references public.quiz_topics (id) on delete cascade,
  attempts_count integer not null default 0,
  correct_count  integer not null default 0,
  mastery_score  numeric(5, 2) not null default 0, -- 0-100, exponential-moving-average of accuracy
  last_attempt_at timestamptz,
  updated_at     timestamptz not null default now(),

  unique (user_id, topic_id)
);

comment on table public.quiz_topic_mastery is
  'Rolling per-topic mastery, updated by analytics.service.ts after every graded attempt. mastery_score < 50 = weak area, >= 80 = strong area (thresholds live in analytics.service.ts, not hardcoded here).';

-- ---- leaderboard -----------------------------------------------------------

create table public.quiz_leaderboard_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  scope        text not null,           -- 'global' | 'subject:<subject>' | 'weekly:<iso_week>'
  subject      text,                    -- populated when scope = 'subject:*'
  score        numeric(10, 2) not null default 0,
  attempts_count integer not null default 0,
  updated_at   timestamptz not null default now(),

  unique (user_id, scope)
);

comment on table public.quiz_leaderboard_entries is
  'Denormalized per-scope score, upserted by leaderboard.service.ts after each graded attempt. Rank is computed at query time via ORDER BY score DESC, not stored.';

create index if not exists quiz_leaderboard_scope_idx on public.quiz_leaderboard_entries (scope, score desc);

-- ---- streaks + badges ------------------------------------------------------

create table public.quiz_streaks (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  current_streak    integer not null default 0,
  longest_streak     integer not null default 0,
  last_activity_date date,
  updated_at        timestamptz not null default now()
);

create table public.quiz_badges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  badge_key   text not null,            -- e.g. 'streak_7', 'topic_master_physics', 'top_10_weekly'
  awarded_at  timestamptz not null default now(),

  unique (user_id, badge_key)
);

-- ---- review / reporting -----------------------------------------------------

create table public.quiz_question_reviews (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.quiz_questions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  marked_for_review boolean not null default false,
  reported_issue    text,               -- null unless the user flagged the question as wrong/unclear
  created_at   timestamptz not null default now()
);

create index if not exists quiz_topic_mastery_user_idx on public.quiz_topic_mastery (user_id);
create index if not exists quiz_badges_user_idx on public.quiz_badges (user_id);
create index if not exists quiz_question_reviews_question_idx on public.quiz_question_reviews (question_id);
