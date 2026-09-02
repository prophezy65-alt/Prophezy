-- ============================================================================
-- PROPHEZY — 0035_assignment_ai_engine.sql
-- Purpose : Persistence for the Assignment AI module (lib/assignment/). This
--           module uploads a document, OCRs it, detects individual questions,
--           and generates a full step-by-step solution per question on
--           demand. That richer, per-question, mode-aware shape doesn't fit
--           the existing public.assignments / public.assignment_questions
--           tables (0009_assignments.sql), which back the simpler
--           "generate a fresh worksheet from a topic" flow used elsewhere
--           (kind = 'assignment' generations). This migration is purely
--           additive — no existing table, column, or row is touched — so the
--           one existing reader of assignments/assignment_questions
--           (lib/quiz/providers/supabase-quiz.provider.ts) is unaffected.
-- Depends : 0001_extensions.sql .. 0017_functions.sql (public.set_updated_at,
--           public.is_admin), 0003_profiles.sql, public.uploads
-- ============================================================================

create table public.assignment_ai_documents (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  upload_id              uuid references public.uploads (id) on delete set null,
  batch_id               uuid not null,
  title                  text not null,
  subject                text not null default '',
  detected_subject_area  text not null default '',
  question_count         integer not null default 0,
  status                 text not null default 'ready',
  error_message          text,
  extraction_warnings    jsonb not null default '[]'::jsonb,
  has_handwriting        boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint assignment_ai_documents_status_check
    check (status in ('processing', 'ready', 'failed'))
);

comment on table public.assignment_ai_documents is
  'One row per uploaded-and-processed document in the Assignment AI module (post OCR + question detection).';

create table public.assignment_ai_questions (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.assignment_ai_documents (id) on delete cascade,
  position          integer not null default 0,
  question_number   text not null default '',
  question_text     text not null,
  question_type     text not null default 'short_answer',
  difficulty        text not null default 'medium',
  subject           text not null default '',
  topic             text not null default '',
  marks             integer,
  detected_question jsonb not null,
  created_at        timestamptz not null default now(),

  constraint assignment_ai_questions_difficulty_check
    check (difficulty in ('easy', 'medium', 'hard', 'expert'))
);

comment on table public.assignment_ai_questions is
  'detected_question stores the full DetectedQuestion payload (lib/assignment/models/types.ts) for fidelity; the flat columns are denormalized for search/filter/sort.';

create table public.assignment_ai_solutions (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.assignment_ai_questions (id) on delete cascade,
  depth_mode   text not null default 'standard',
  solution     jsonb not null,
  created_at   timestamptz not null default now(),

  constraint assignment_ai_solutions_depth_mode_check
    check (depth_mode in ('simple', 'standard', 'technical')),
  unique (question_id, depth_mode)
);

comment on table public.assignment_ai_solutions is
  'solution stores the full QuestionSolution payload. One row per (question, depth mode) so switching modes doesn''t re-spend AI budget on a mode already generated.';

create table public.assignment_ai_exports (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.assignment_ai_documents (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  format        text not null,
  file_name     text not null,
  created_at    timestamptz not null default now(),

  constraint assignment_ai_exports_format_check
    check (format in ('pdf', 'docx', 'markdown', 'html', 'json', 'csv'))
);

comment on table public.assignment_ai_exports is
  'Export history log. Files are generated on demand and streamed to the client, not stored — this table is the "you exported this before" record for Assignment History.';

create index assignment_ai_documents_user_id_created_at_idx
  on public.assignment_ai_documents (user_id, created_at desc);

create index assignment_ai_questions_document_id_position_idx
  on public.assignment_ai_questions (document_id, position);

create index assignment_ai_solutions_question_id_idx
  on public.assignment_ai_solutions (question_id);

create index assignment_ai_exports_document_id_idx
  on public.assignment_ai_exports (document_id);

create trigger set_updated_at before update on public.assignment_ai_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security — same "owner or admin" convention as 0019_rls.sql
-- ---------------------------------------------------------------------------

alter table public.assignment_ai_documents enable row level security;
alter table public.assignment_ai_questions enable row level security;
alter table public.assignment_ai_solutions enable row level security;
alter table public.assignment_ai_exports enable row level security;

create policy "assignment_ai_documents_select_own_or_admin" on public.assignment_ai_documents
  for select using (public.is_admin() or user_id = auth.uid());

create policy "assignment_ai_documents_insert_own" on public.assignment_ai_documents
  for insert with check (user_id = auth.uid());

create policy "assignment_ai_documents_update_own_or_admin" on public.assignment_ai_documents
  for update using (public.is_admin() or user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "assignment_ai_documents_delete_own_or_admin" on public.assignment_ai_documents
  for delete using (public.is_admin() or user_id = auth.uid());

create policy "assignment_ai_questions_select_own_or_admin" on public.assignment_ai_questions
  for select using (
    public.is_admin() or exists (
      select 1 from public.assignment_ai_documents d
      where d.id = assignment_ai_questions.document_id and d.user_id = auth.uid()
    )
  );

create policy "assignment_ai_questions_insert_own" on public.assignment_ai_questions
  for insert with check (
    exists (
      select 1 from public.assignment_ai_documents d
      where d.id = assignment_ai_questions.document_id and d.user_id = auth.uid()
    )
  );

create policy "assignment_ai_questions_delete_own_or_admin" on public.assignment_ai_questions
  for delete using (
    public.is_admin() or exists (
      select 1 from public.assignment_ai_documents d
      where d.id = assignment_ai_questions.document_id and d.user_id = auth.uid()
    )
  );

create policy "assignment_ai_solutions_select_own_or_admin" on public.assignment_ai_solutions
  for select using (
    public.is_admin() or exists (
      select 1 from public.assignment_ai_questions q
      join public.assignment_ai_documents d on d.id = q.document_id
      where q.id = assignment_ai_solutions.question_id and d.user_id = auth.uid()
    )
  );

create policy "assignment_ai_solutions_insert_own" on public.assignment_ai_solutions
  for insert with check (
    exists (
      select 1 from public.assignment_ai_questions q
      join public.assignment_ai_documents d on d.id = q.document_id
      where q.id = assignment_ai_solutions.question_id and d.user_id = auth.uid()
    )
  );

create policy "assignment_ai_solutions_delete_own_or_admin" on public.assignment_ai_solutions
  for delete using (
    public.is_admin() or exists (
      select 1 from public.assignment_ai_questions q
      join public.assignment_ai_documents d on d.id = q.document_id
      where q.id = assignment_ai_solutions.question_id and d.user_id = auth.uid()
    )
  );

create policy "assignment_ai_exports_select_own_or_admin" on public.assignment_ai_exports
  for select using (public.is_admin() or user_id = auth.uid());

create policy "assignment_ai_exports_insert_own" on public.assignment_ai_exports
  for insert with check (user_id = auth.uid());
