-- ============================================================================
-- PROPHEZY — 0023_quiz_topics.sql
-- Purpose : Topic taxonomy for weightage, weak/strong-area detection, and
--           concept mapping. A topic can be scoped to a subject and
--           optionally nested (e.g. "Thermodynamics" under "Physics").
-- Depends : 0003_profiles.sql, 0022_quiz_engine_extend.sql
-- ============================================================================

create table public.quiz_topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  parent_id   uuid references public.quiz_topics (id) on delete set null,
  name        text not null,
  subject     text,
  created_at  timestamptz not null default now(),

  unique (user_id, parent_id, name)
);

comment on table public.quiz_topics is
  'User-scoped topic taxonomy used for topic-weightage, concept mapping, and weak/strong-area analytics. parent_id enables a subject -> chapter -> topic hierarchy.';

-- Now that quiz_topics exists, wire the FKs added as bare uuid columns in 0022.
alter table public.quiz_questions
  add constraint quiz_questions_topic_id_fkey
  foreign key (topic_id) references public.quiz_topics (id) on delete set null;

create index if not exists quiz_topics_user_idx on public.quiz_topics (user_id);
create index if not exists quiz_topics_parent_idx on public.quiz_topics (parent_id);
