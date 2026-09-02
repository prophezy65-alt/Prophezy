-- ============================================================================
-- PROPHEZY — 0021_quiz_engine_enums.sql
-- Purpose : New enum types for the Quiz Intelligence Engine. Additive only —
--           does not modify any enum defined in 0002_enums.sql.
-- Depends : 0002_enums.sql
-- ============================================================================

create type public.quiz_question_type as enum (
  'mcq',
  'true_false',
  'fill_in_blank',
  'one_word',
  'multiple_select',
  'match_following',
  'ordering',
  'short_answer',
  'long_answer',
  'essay',
  'case_study',
  'programming',
  'debugging',
  'sql',
  'mathematics',
  'physics',
  'chemistry',
  'biology',
  'engineering',
  'medical',
  'law',
  'business',
  'ai_ml',
  'coding_challenge'
);

comment on type public.quiz_question_type is
  'Discriminator for quiz_questions.metadata payload shape. See lib/quiz/validation for the corresponding zod schema per type.';

create type public.quiz_difficulty as enum ('easy', 'medium', 'hard', 'expert');

create type public.quiz_exam_mode as enum (
  'practice',
  'timed_test',
  'mock_exam',
  'competitive_exam',
  'revision_test',
  'chapter_test',
  'unit_test',
  'semester_exam',
  'final_exam',
  'custom_exam'
);

create type public.quiz_attempt_status as enum (
  'in_progress', 'submitted', 'graded', 'abandoned'
);

create type public.quiz_grading_method as enum (
  'exact_match',     -- mcq, true_false, one_word, fill_in_blank
  'set_match',       -- multiple_select, match_following, ordering
  'ai_graded'        -- short_answer, long_answer, essay, case_study,
                     -- programming, debugging, sql, subject-specific types
);

comment on type public.quiz_grading_method is
  'Determines whether grading.service.ts scores a response locally (exact_match/set_match) or via runStructured() AI grading (ai_graded).';
