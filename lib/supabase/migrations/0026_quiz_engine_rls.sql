-- ============================================================================
-- PROPHEZY — 0026_quiz_engine_rls.sql
-- Purpose : Row-level security for every table introduced by the Quiz
--           Intelligence Engine. Ownership flows through user_id directly
--           where present, or through a join up to quizzes/generations
--           where it isn't (quiz_questions, quiz_responses).
-- Depends : 0019_rls.sql, 0024_quiz_attempts.sql, 0025_quiz_analytics_leaderboard.sql
-- ============================================================================

alter table public.quiz_topics             enable row level security;
alter table public.quiz_attempts           enable row level security;
alter table public.quiz_responses          enable row level security;
alter table public.quiz_topic_mastery      enable row level security;
alter table public.quiz_leaderboard_entries enable row level security;
alter table public.quiz_streaks            enable row level security;
alter table public.quiz_badges             enable row level security;
alter table public.quiz_question_reviews   enable row level security;

-- quiz_topics: owned directly by user_id
create policy quiz_topics_owner_all on public.quiz_topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quiz_attempts: owned directly by user_id
create policy quiz_attempts_owner_all on public.quiz_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quiz_responses: ownership via parent attempt
create policy quiz_responses_owner_all on public.quiz_responses
  for all using (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = quiz_responses.attempt_id and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = quiz_responses.attempt_id and a.user_id = auth.uid()
    )
  );

-- quiz_topic_mastery: owned directly by user_id
create policy quiz_topic_mastery_owner_all on public.quiz_topic_mastery
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quiz_leaderboard_entries: everyone can read (it's a leaderboard), only the
-- owning user's row can be written, and only by the service role in practice
-- (leaderboard.service.ts runs with the service key after grading).
create policy quiz_leaderboard_read_all on public.quiz_leaderboard_entries
  for select using (true);
create policy quiz_leaderboard_owner_write on public.quiz_leaderboard_entries
  for insert with check (auth.uid() = user_id);
create policy quiz_leaderboard_owner_update on public.quiz_leaderboard_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quiz_streaks / quiz_badges: owned directly by user_id
create policy quiz_streaks_owner_all on public.quiz_streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy quiz_badges_owner_all on public.quiz_badges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quiz_question_reviews: owned directly by user_id (own flags/reports only)
create policy quiz_question_reviews_owner_all on public.quiz_question_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
