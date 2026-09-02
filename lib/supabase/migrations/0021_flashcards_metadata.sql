-- ============================================================================
-- PROPHEZY — 0021_flashcards_metadata.sql
-- Purpose : ADDITIVE support for the Flashcards Intelligence Engine.
--           Adds nullable columns + two new tables. Does NOT alter, rename,
--           or drop anything from 0008_flashcards.sql. Safe to run on top of
--           existing data — every new column has a default or is nullable.
-- Depends : 0008_flashcards.sql, 0002_enums.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- flashcards: card typing, tagging, difficulty/confidence, semantic search,
-- and the extra fields needed for non Q->A card types (image/diagram/code/
-- fill-blank/step-ordering/etc). All nullable / defaulted -> non-breaking.
-- ---------------------------------------------------------------------------
alter table public.flashcards
  add column if not exists card_type      text not null default 'qa',
  add column if not exists tags           text[] not null default '{}',
  add column if not exists hint           text,
  add column if not exists mnemonic       text,
  add column if not exists explanation    text,
  add column if not exists difficulty     smallint not null default 3
    check (difficulty between 1 and 5),
  add column if not exists confidence     numeric(4, 3) not null default 0.5
    check (confidence between 0 and 1),
  add column if not exists source_excerpt text,
  add column if not exists image_url      text,
  add column if not exists metadata       jsonb not null default '{}'::jsonb,
  add column if not exists embedding      vector(768),
  add column if not exists duplicate_of   uuid references public.flashcards (id) on delete set null;

comment on column public.flashcards.card_type is
  'One of: qa, definition, term, formula, image_concept, diagram_labels, code_output, output_code, true_false, fill_blank, one_word, concept_recall, step_ordering, case_study, programming_recall, algorithm_recall, medical_recall, legal_recall, business_recall, engineering_recall, vocabulary.';
comment on column public.flashcards.embedding is
  'pgvector embedding of front+back+explanation for semantic search. Populated by concept.service.ts via AI Core Engine embed().';

create index if not exists flashcards_embedding_idx
  on public.flashcards using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists flashcards_tags_idx
  on public.flashcards using gin (tags);
create index if not exists flashcards_card_type_idx
  on public.flashcards (card_type);

-- ---------------------------------------------------------------------------
-- flashcard_decks: learning mode + source tracking (which inputs it was
-- built from), so generator.service.ts / study-hub can show provenance.
-- ---------------------------------------------------------------------------
alter table public.flashcard_decks
  add column if not exists learning_mode text not null default 'intermediate',
  add column if not exists source_type   text,
  add column if not exists source_ref    text,
  add column if not exists metadata      jsonb not null default '{}'::jsonb;

comment on column public.flashcard_decks.learning_mode is
  'One of: beginner, intermediate, advanced, exam, competitive_exam, revision, quick_revision, long_term.';

-- ---------------------------------------------------------------------------
-- flashcard_concepts: extracted concepts/topics per deck, used by
-- concept.service.ts, keyword.service.ts, and search.service.ts (topic
-- search / concept search). Many-to-many with cards via flashcard_id array
-- kept simple on purpose — this is a new, additive table.
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_concepts (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null references public.flashcard_decks (id) on delete cascade,
  name        text not null,
  kind        text not null default 'concept', -- concept | topic | keyword | formula | date | name
  weight      numeric(4, 3) not null default 1.0,
  card_ids    uuid[] not null default '{}',
  created_at  timestamptz not null default now(),

  unique (deck_id, name, kind)
);

create index if not exists flashcard_concepts_deck_idx
  on public.flashcard_concepts (deck_id);

-- ---------------------------------------------------------------------------
-- flashcard_study_sessions: one row per study session, so
-- analytics.service.ts can compute streaks / time studied / completion %
-- without scanning flashcard_reviews by session boundary heuristics.
-- ---------------------------------------------------------------------------
create table if not exists public.flashcard_study_sessions (
  id           uuid primary key default gen_random_uuid(),
  deck_id      uuid not null references public.flashcard_decks (id) on delete cascade,
  user_id      uuid not null,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  cards_seen   integer not null default 0,
  cards_correct integer not null default 0
);

create index if not exists flashcard_study_sessions_user_idx
  on public.flashcard_study_sessions (user_id, started_at desc);

comment on table public.flashcard_concepts is
  'Additive (0021). Concepts/topics/keywords extracted per deck for search + analytics.';
comment on table public.flashcard_study_sessions is
  'Additive (0021). One row per study session for streaks/time-studied analytics.';
