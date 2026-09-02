-- ============================================================================
-- PROPHEZY — 0029_chat_enums.sql
-- Purpose : New enum types for the AI Chat Assistant / Master Orchestrator.
--           Additive only — does not modify any enum from 0002_enums.sql.
-- Depends : 0002_enums.sql
-- ============================================================================

create type public.chat_message_role as enum ('user', 'assistant', 'system');

create type public.chat_session_status as enum ('active', 'archived');

create type public.assistant_feedback_rating as enum ('thumbs_up', 'thumbs_down');

-- Mirrors the 14 routable modules from the mission spec. Kept as an enum
-- (not a free-text column) so router.service.ts's module registry and the
-- DB stay in lockstep — adding a 15th module means editing this enum AND
-- registering the adapter, which is the point (no silent drift).
create type public.chat_module as enum (
  'resume_studio',
  'research_ai',
  'project_generator',
  'syllabus_ai',
  'assignment_ai',
  'notes_ai',
  'flashcards_ai',
  'quiz_ai',
  'interview_ai',
  'career_guidance_ai',
  'internship_discovery_ai',
  'hackathon_ai',
  'humanizer_ai',
  'document_intelligence_engine'
);
