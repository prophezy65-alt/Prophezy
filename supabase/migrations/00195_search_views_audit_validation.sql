-- ============================================================
-- Phase 2 (part 2): Full-text search, views, audit logging,
-- and validation constraints — the confirmed gaps against the
-- real schema. Everything else requested (FKs, indexes, RLS,
-- updated_at triggers, is_admin(), handle_new_user()) already
-- existed and is untouched here.
-- ============================================================

-- ------------------------------------------------------------
-- SECTION 1: Full-text search
--
-- Using a plain tsvector column + BEFORE INSERT/UPDATE trigger,
-- NOT a generated column. to_tsvector(regconfig, text) is only
-- STABLE, not IMMUTABLE, in Postgres — GENERATED ALWAYS AS
-- columns require IMMUTABLE expressions, so a generated-column
-- approach risks failing at migration time. A trigger has no
-- such restriction and is the pattern Postgres's own docs use.
-- ------------------------------------------------------------

-- internships: company_name + role_title (weight A), location (B), description (C)
alter table public.internships add column if not exists search_vector tsvector;

create or replace function public.tsv_internships() returns trigger
language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.company_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.role_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.location, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

drop trigger if exists trg_internships_search_vector on public.internships;
create trigger trg_internships_search_vector
  before insert or update on public.internships
  for each row execute function public.tsv_internships();

update public.internships set search_vector =
  setweight(to_tsvector('english', coalesce(company_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(role_title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(location, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C');

create index if not exists idx_internships_search_vector on public.internships using gin (search_vector);

create or replace function public.search_internships(p_query text, p_limit int default 20)
returns setof public.internships
language sql stable security invoker set search_path = public as $$
  select *
  from public.internships
  where search_vector @@ websearch_to_tsquery('english', p_query)
  order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc,
           deadline_at nulls last
  limit p_limit;
$$;

-- notes: content_md
alter table public.notes add column if not exists search_vector tsvector;

create or replace function public.tsv_notes() returns trigger
language plpgsql as $$
begin
  new.search_vector := to_tsvector('english', coalesce(new.content_md, ''));
  return new;
end;
$$;

drop trigger if exists trg_notes_search_vector on public.notes;
create trigger trg_notes_search_vector
  before insert or update on public.notes
  for each row execute function public.tsv_notes();

update public.notes set search_vector = to_tsvector('english', coalesce(content_md, ''));

create index if not exists idx_notes_search_vector on public.notes using gin (search_vector);

create or replace function public.search_notes(p_query text, p_limit int default 20)
returns setof public.notes
language sql stable security invoker set search_path = public as $$
  select *
  from public.notes
  where search_vector @@ websearch_to_tsquery('english', p_query)
  order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc
  limit p_limit;
$$;

-- research_papers: title (A), abstract (B), summary_md (C)
-- Complements the existing trigram index on title (fuzzy/typo-tolerant)
-- with ranked keyword search across the full text — different job, not a duplicate.
alter table public.research_papers add column if not exists search_vector tsvector;

create or replace function public.tsv_research_papers() returns trigger
language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.abstract, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.summary_md, '')), 'C');
  return new;
end;
$$;

drop trigger if exists trg_research_papers_search_vector on public.research_papers;
create trigger trg_research_papers_search_vector
  before insert or update on public.research_papers
  for each row execute function public.tsv_research_papers();

update public.research_papers set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(abstract, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(summary_md, '')), 'C');

create index if not exists idx_research_papers_search_vector on public.research_papers using gin (search_vector);

create or replace function public.search_research_papers(p_query text, p_limit int default 20)
returns setof public.research_papers
language sql stable security invoker set search_path = public as $$
  select *
  from public.research_papers
  where search_vector @@ websearch_to_tsquery('english', p_query)
  order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc
  limit p_limit;
$$;

-- projects: title (A), description (B), tech_stack (B)
alter table public.projects add column if not exists search_vector tsvector;

create or replace function public.tsv_projects() returns trigger
language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(new.tech_stack, ' ')), 'B');
  return new;
end;
$$;

drop trigger if exists trg_projects_search_vector on public.projects;
create trigger trg_projects_search_vector
  before insert or update on public.projects
  for each row execute function public.tsv_projects();

update public.projects set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', array_to_string(tech_stack, ' ')), 'B');

create index if not exists idx_projects_search_vector on public.projects using gin (search_vector);

create or replace function public.search_projects(p_query text, p_limit int default 20)
returns setof public.projects
language sql stable security invoker set search_path = public as $$
  select *
  from public.projects
  where search_vector @@ websearch_to_tsquery('english', p_query)
  order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc
  limit p_limit;
$$;

-- trending_research_topics: title (A), field (B), summary (C)
alter table public.trending_research_topics add column if not exists search_vector tsvector;

create or replace function public.tsv_trending_topics() returns trigger
language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.field, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.summary, '')), 'C');
  return new;
end;
$$;

drop trigger if exists trg_trending_topics_search_vector on public.trending_research_topics;
create trigger trg_trending_topics_search_vector
  before insert or update on public.trending_research_topics
  for each row execute function public.tsv_trending_topics();

update public.trending_research_topics set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(field, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(summary, '')), 'C');

create index if not exists idx_trending_topics_search_vector on public.trending_research_topics using gin (search_vector);

create or replace function public.search_trending_topics(p_query text, p_limit int default 20)
returns setof public.trending_research_topics
language sql stable security invoker set search_path = public as $$
  select *
  from public.trending_research_topics
  where search_vector @@ websearch_to_tsquery('english', p_query)
  order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc, trend_score desc
  limit p_limit;
$$;

-- NOTE: resumes.content and quiz_questions.options are jsonb, not plain
-- text — deliberately NOT given tsvector search here. Resume content is
-- already scoped for the vector/RAG pipeline in Phase 6; bolting on a
-- second, different search mechanism now would just be replaced later.

-- ------------------------------------------------------------
-- SECTION 2: Views
--
-- IMPORTANT: every view is created WITH (security_invoker = true).
-- Without this, a view runs with its OWNER's privileges (typically
-- postgres, which bypasses RLS entirely) instead of the querying
-- user's — meaning any view without this flag would silently leak
-- every user's rows to every other user. This is a Postgres 15+
-- feature and is required, not optional, on every view below.
-- ------------------------------------------------------------

create or replace view public.v_internship_feed
with (security_invoker = true) as
select
  i.*,
  (i.deadline_at is not null and i.deadline_at < current_date) as is_expired,
  (i.deadline_at - current_date) as days_until_deadline
from public.internships i
order by i.deadline_at nulls last, i.posted_at desc;

create or replace view public.v_flashcards_due
with (security_invoker = true) as
select
  f.*,
  d.title as deck_title,
  g.user_id as owner_id
from public.flashcards f
join public.flashcard_decks d on d.id = f.deck_id
join public.generations g on g.id = d.generation_id
where f.due_at <= now();

create or replace view public.v_upcoming_deadlines
with (security_invoker = true) as
select
  'internship'::text as kind,
  ia.id as source_id,
  i.role_title as title,
  i.deadline_at as due_date,
  ia.status::text as status
from public.internship_applications ia
join public.internships i on i.id = ia.internship_id
where i.deadline_at is not null and i.deadline_at >= current_date

union all

select
  'milestone'::text as kind,
  pm.id as source_id,
  pm.title,
  pm.due_date,
  case when pm.is_completed then 'completed' else 'pending' end as status
from public.project_milestones pm
where pm.due_date is not null and pm.due_date >= current_date and pm.is_completed = false;

-- Dashboard summary as a function rather than a view: it's a single
-- aggregated row per caller, which a view would express awkwardly.
-- Every subquery here is scoped by the RLS of its underlying table
-- via SECURITY INVOKER, so this naturally returns "my" counts for a
-- student and "everyone's" counts for an admin — no manual user_id
-- filtering needed, it inherits the same policies already in place.
create or replace function public.get_dashboard_summary()
returns table (
  total_generations bigint,
  total_resumes bigint,
  total_projects bigint,
  total_bookmarks bigint,
  unread_notifications bigint,
  saved_internships bigint,
  flashcards_due bigint
)
language sql stable security invoker set search_path = public as $$
  select
    (select count(*) from public.generations) as total_generations,
    (select count(*) from public.resumes) as total_resumes,
    (select count(*) from public.projects) as total_projects,
    (select count(*) from public.bookmarks) as total_bookmarks,
    (select count(*) from public.notifications where is_read = false) as unread_notifications,
    (select count(*) from public.internship_applications where status = 'saved') as saved_internships,
    (select count(*) from public.v_flashcards_due) as flashcards_due;
$$;

-- ------------------------------------------------------------
-- SECTION 3: Automated audit logging
--
-- admin_audit_log existed with RLS but nothing ever wrote to it —
-- it only filled up if something manually inserted a row, and
-- nothing did. This trigger fills that gap: it fires on writes to
-- admin-managed tables and logs them ONLY when the acting user is
-- an admin (is_admin() = true). Ordinary users editing their own
-- rows (e.g. a student updating their own profile) do NOT get
-- logged here — that's normal user activity, not an admin action,
-- and admin_audit_log's own schema (admin_id NOT NULL) reflects
-- that it was never meant to hold anything else.
-- ------------------------------------------------------------

create or replace function public.log_admin_action() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_target_id uuid;
begin
  if not public.is_admin() then
    return coalesce(new, old);
  end if;

  v_target_id := case when TG_OP = 'DELETE' then old.id else new.id end;

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, metadata)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_target_id,
    jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.log_admin_action();

drop trigger if exists trg_audit_internships on public.internships;
create trigger trg_audit_internships
  after insert or update or delete on public.internships
  for each row execute function public.log_admin_action();

drop trigger if exists trg_audit_trending_topics on public.trending_research_topics;
create trigger trg_audit_trending_topics
  after insert or update or delete on public.trending_research_topics
  for each row execute function public.log_admin_action();

drop trigger if exists trg_audit_subscriptions on public.subscriptions;
create trigger trg_audit_subscriptions
  after insert or update or delete on public.subscriptions
  for each row execute function public.log_admin_action();

drop trigger if exists trg_audit_payment_transactions on public.payment_transactions;
create trigger trg_audit_payment_transactions
  after insert or update or delete on public.payment_transactions
  for each row execute function public.log_admin_action();

-- Note: an admin editing their OWN profile also gets logged here (is_admin()
-- doesn't check whose row it is). That's a deliberate simplification, not
-- an oversight — excluding self-edits adds complexity for minimal benefit.

-- ------------------------------------------------------------
-- SECTION 4: Additional validation constraints
--
-- Only constraints I could verify are safe against your real data
-- shape. Two were deliberately left OUT rather than guessed:
--   - payment_transactions.status is free text with no enum. I'm not
--     adding a CHECK against a guessed status vocabulary (e.g.
--     Razorpay vs Stripe use completely different strings) because a
--     wrong guess would break real payment webhook inserts in
--     production. Tell me your payment provider and I'll add the
--     correct one.
--   - quiz_questions.correct_option isn't validated against the shape
--     of the options jsonb column, since I don't know that shape.
-- ------------------------------------------------------------

alter table public.internships drop constraint if exists internships_deadline_after_posted;
alter table public.internships add constraint internships_deadline_after_posted
  check (deadline_at is null or deadline_at >= posted_at);

alter table public.flashcards drop constraint if exists flashcards_ease_factor_check;
alter table public.flashcards add constraint flashcards_ease_factor_check
  check (ease_factor >= 1.3);

alter table public.flashcards drop constraint if exists flashcards_repetitions_check;
alter table public.flashcards add constraint flashcards_repetitions_check
  check (repetitions >= 0);

alter table public.flashcards drop constraint if exists flashcards_interval_days_check;
alter table public.flashcards add constraint flashcards_interval_days_check
  check (interval_days >= 0);

alter table public.study_sessions drop constraint if exists study_sessions_ended_after_started;
alter table public.study_sessions add constraint study_sessions_ended_after_started
  check (ended_at is null or ended_at >= started_at);

alter table public.study_sessions drop constraint if exists study_sessions_duration_nonnegative;
alter table public.study_sessions add constraint study_sessions_duration_nonnegative
  check (duration_seconds is null or duration_seconds >= 0);

alter table public.payment_transactions drop constraint if exists payment_transactions_amount_nonnegative;
alter table public.payment_transactions add constraint payment_transactions_amount_nonnegative
  check (amount >= 0);

alter table public.subscriptions drop constraint if exists subscriptions_period_order;
alter table public.subscriptions add constraint subscriptions_period_order
  check (current_period_end is null or current_period_start is null or current_period_end >= current_period_start);
