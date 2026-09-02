-- ============================================================================
-- PROPHEZY — 0008_flashcards.sql
-- Purpose : Flashcard decks + cards + spaced-repetition review history.
-- Depends : 0002_enums.sql, 0007_notes.sql (generations)
-- ============================================================================

create table public.flashcard_decks (
  id            uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  title         text not null,
  card_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (generation_id)
);

create table public.flashcards (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.flashcard_decks (id) on delete cascade,
  front         text not null,
  back          text not null,
  position      integer not null default 0,
  ease_factor   numeric(4, 2) not null default 2.50,
  interval_days integer not null default 0,
  repetitions   integer not null default 0,
  due_at        timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.flashcard_reviews (
  id              uuid primary key default gen_random_uuid(),
  flashcard_id    uuid not null references public.flashcards (id) on delete cascade,
  rating          public.flashcard_rating not null,
  interval_before integer not null,
  interval_after  integer not null,
  reviewed_at     timestamptz not null default now()
);

comment on table public.flashcards is
  'ease_factor / interval_days / repetitions / due_at implement SM-2 style spaced repetition.';
comment on table public.flashcard_reviews is
  'Append-only review log. One row per time a user answers a flashcard. Written by apply_flashcard_review() (0017).';
