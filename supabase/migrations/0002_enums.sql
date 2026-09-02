-- ============================================================================
-- PROPHEZY — 0002_enums.sql
-- Purpose : Every enum type used anywhere in the schema, defined once, up
--           front, so every later migration can reference them safely.
-- Depends : 0001_extensions.sql
-- ============================================================================

create type public.user_role as enum ('student', 'admin');

create type public.plan_tier as enum ('free', 'pro');

create type public.subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled', 'none'
);

create type public.upload_status as enum ('pending', 'processing', 'ready', 'failed');

create type public.generation_kind as enum (
  'notes', 'revision_notes', 'one_day_revision', 'flashcards', 'quiz',
  'mind_map', 'formula_sheet', 'important_questions', 'expected_questions',
  'mcqs', 'assignment', 'eli_beginner', 'eli_professor'
);

create type public.flashcard_rating as enum ('again', 'hard', 'good', 'easy');

create type public.project_status as enum ('idea', 'in_progress', 'completed', 'archived');

create type public.resume_status as enum ('draft', 'final');

create type public.internship_type as enum ('internship', 'part_time', 'full_time');

create type public.application_status as enum (
  'saved', 'applied', 'interviewing', 'offer', 'rejected'
);

create type public.notification_type as enum (
  'generation_complete', 'subscription', 'internship', 'research', 'system', 'admin'
);
