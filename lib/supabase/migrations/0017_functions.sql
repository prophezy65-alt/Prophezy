-- ============================================================================
-- PROPHEZY — 0017_functions.sql
-- Purpose : Reusable helper + trigger functions. No triggers are attached
--           here — that happens in 0018_triggers.sql — so this file can be
--           edited independently of trigger wiring.
-- Depends : 0003_profiles.sql .. 0015_subscriptions.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- set_updated_at: generic trigger function, bumps updated_at to now()
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user: creates a profiles row + a default 'free' subscription row
-- whenever a new auth.users row appears. full_name/avatar_url are pulled from
-- OAuth/signup metadata when present, falling back to sane defaults so the
-- insert never fails.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.subscriptions (user_id, plan_tier, status)
  values (new.id, 'free', 'none');

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- is_admin: RLS helper. Checks the caller's own profile row for role='admin'.
-- security definer so it can read profiles even before RLS policies exist
-- on the caller's own row; stable so the planner can cache it per statement.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- apply_flashcard_review: records a review and advances the SM-2 schedule
-- for that card in one atomic step.
-- ---------------------------------------------------------------------------
create or replace function public.apply_flashcard_review(
  p_flashcard_id uuid,
  p_rating public.flashcard_rating
)
returns public.flashcards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card         public.flashcards;
  v_new_ease     numeric(4,2);
  v_new_interval integer;
  v_new_reps     integer;
begin
  select * into v_card from public.flashcards where id = p_flashcard_id for update;

  if not found then
    raise exception 'flashcard % not found', p_flashcard_id;
  end if;

  if p_rating = 'again' then
    v_new_reps := 0;
    v_new_interval := 1;
    v_new_ease := greatest(v_card.ease_factor - 0.20, 1.30);
  else
    v_new_reps := v_card.repetitions + 1;
    v_new_ease := case p_rating
      when 'hard' then greatest(v_card.ease_factor - 0.15, 1.30)
      when 'good' then v_card.ease_factor
      when 'easy' then v_card.ease_factor + 0.15
    end;
    v_new_interval := case
      when v_new_reps = 1 then 1
      when v_new_reps = 2 then 6
      else round(v_card.interval_days * v_new_ease)
    end;
  end if;

  insert into public.flashcard_reviews (flashcard_id, rating, interval_before, interval_after)
  values (p_flashcard_id, p_rating, v_card.interval_days, v_new_interval);

  update public.flashcards
  set ease_factor   = v_new_ease,
      interval_days = v_new_interval,
      repetitions   = v_new_reps,
      due_at        = now() + (v_new_interval || ' days')::interval,
      updated_at    = now()
  where id = p_flashcard_id
  returning * into v_card;

  return v_card;
end;
$$;
