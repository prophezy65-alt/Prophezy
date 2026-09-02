-- ============================================================================
-- PROPHEZY — 0019_rls.sql
-- Purpose : Enable Row Level Security on every table and define ownership +
--           admin-bypass policies. This is intentionally the LAST
--           table-touching migration — every table, column, and the
--           is_admin() helper (0017) already exist by this point.
-- Depends : 0003_profiles.sql .. 0017_functions.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- no insert/delete policy: rows are created by handle_new_user() (security
-- definer, bypasses RLS) and removed via the auth.users cascade.

-- ---------------------------------------------------------------------------
-- UPLOADS
-- ---------------------------------------------------------------------------
alter table public.uploads enable row level security;

create policy "uploads_select_own_or_admin" on public.uploads
  for select using (user_id = auth.uid() or public.is_admin());

create policy "uploads_insert_own" on public.uploads
  for insert with check (user_id = auth.uid());

create policy "uploads_update_own_or_admin" on public.uploads
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "uploads_delete_own_or_admin" on public.uploads
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- DOCUMENT_CHUNKS  (written by the ingestion pipeline via service_role,
-- which bypasses RLS entirely — regular users only ever read)
-- ---------------------------------------------------------------------------
alter table public.document_chunks enable row level security;

create policy "document_chunks_select_own_or_admin" on public.document_chunks
  for select using (
    public.is_admin() or exists (
      select 1 from public.uploads u
      where u.id = document_chunks.upload_id and u.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- GENERATIONS
-- ---------------------------------------------------------------------------
alter table public.generations enable row level security;

create policy "generations_select_own_or_admin" on public.generations
  for select using (user_id = auth.uid() or public.is_admin());

create policy "generations_insert_own" on public.generations
  for insert with check (user_id = auth.uid());

create policy "generations_update_own_or_admin" on public.generations
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "generations_delete_own_or_admin" on public.generations
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- NOTES  (ownership via generations.user_id)
-- ---------------------------------------------------------------------------
alter table public.notes enable row level security;

create policy "notes_select_own_or_admin" on public.notes
  for select using (
    public.is_admin() or exists (
      select 1 from public.generations g
      where g.id = notes.generation_id and g.user_id = auth.uid()
    )
  );

create policy "notes_insert_own" on public.notes
  for insert with check (
    exists (select 1 from public.generations g where g.id = notes.generation_id and g.user_id = auth.uid())
  );

create policy "notes_update_own_or_admin" on public.notes
  for update using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = notes.generation_id and g.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.generations g where g.id = notes.generation_id and g.user_id = auth.uid())
  );

create policy "notes_delete_own_or_admin" on public.notes
  for delete using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = notes.generation_id and g.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- FLASHCARDS
-- ---------------------------------------------------------------------------
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;

create policy "flashcard_decks_select_own_or_admin" on public.flashcard_decks
  for select using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = flashcard_decks.generation_id and g.user_id = auth.uid())
  );

create policy "flashcard_decks_insert_own" on public.flashcard_decks
  for insert with check (
    exists (select 1 from public.generations g where g.id = flashcard_decks.generation_id and g.user_id = auth.uid())
  );

create policy "flashcard_decks_update_own_or_admin" on public.flashcard_decks
  for update using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = flashcard_decks.generation_id and g.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.generations g where g.id = flashcard_decks.generation_id and g.user_id = auth.uid())
  );

create policy "flashcard_decks_delete_own_or_admin" on public.flashcard_decks
  for delete using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = flashcard_decks.generation_id and g.user_id = auth.uid())
  );

create policy "flashcards_select_own_or_admin" on public.flashcards
  for select using (
    public.is_admin() or exists (
      select 1 from public.flashcard_decks d join public.generations g on g.id = d.generation_id
      where d.id = flashcards.deck_id and g.user_id = auth.uid()
    )
  );

create policy "flashcards_insert_own" on public.flashcards
  for insert with check (
    exists (
      select 1 from public.flashcard_decks d join public.generations g on g.id = d.generation_id
      where d.id = flashcards.deck_id and g.user_id = auth.uid()
    )
  );

create policy "flashcards_update_own_or_admin" on public.flashcards
  for update using (
    public.is_admin() or exists (
      select 1 from public.flashcard_decks d join public.generations g on g.id = d.generation_id
      where d.id = flashcards.deck_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.flashcard_decks d join public.generations g on g.id = d.generation_id
      where d.id = flashcards.deck_id and g.user_id = auth.uid()
    )
  );

create policy "flashcards_delete_own_or_admin" on public.flashcards
  for delete using (
    public.is_admin() or exists (
      select 1 from public.flashcard_decks d join public.generations g on g.id = d.generation_id
      where d.id = flashcards.deck_id and g.user_id = auth.uid()
    )
  );

create policy "flashcard_reviews_select_own_or_admin" on public.flashcard_reviews
  for select using (
    public.is_admin() or exists (
      select 1 from public.flashcards f
      join public.flashcard_decks d on d.id = f.deck_id
      join public.generations g on g.id = d.generation_id
      where f.id = flashcard_reviews.flashcard_id and g.user_id = auth.uid()
    )
  );

create policy "flashcard_reviews_insert_own" on public.flashcard_reviews
  for insert with check (
    exists (
      select 1 from public.flashcards f
      join public.flashcard_decks d on d.id = f.deck_id
      join public.generations g on g.id = d.generation_id
      where f.id = flashcard_reviews.flashcard_id and g.user_id = auth.uid()
    )
  );

-- reviews are append-only: no update/delete policy for anyone but admin at the DB level is unnecessary here

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS & QUIZZES
-- ---------------------------------------------------------------------------
alter table public.assignments enable row level security;
alter table public.assignment_questions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;

create policy "assignments_select_own_or_admin" on public.assignments
  for select using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = assignments.generation_id and g.user_id = auth.uid())
  );

create policy "assignments_insert_own" on public.assignments
  for insert with check (
    exists (select 1 from public.generations g where g.id = assignments.generation_id and g.user_id = auth.uid())
  );

create policy "assignments_update_own_or_admin" on public.assignments
  for update using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = assignments.generation_id and g.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.generations g where g.id = assignments.generation_id and g.user_id = auth.uid())
  );

create policy "assignments_delete_own_or_admin" on public.assignments
  for delete using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = assignments.generation_id and g.user_id = auth.uid())
  );

create policy "assignment_questions_select_own_or_admin" on public.assignment_questions
  for select using (
    public.is_admin() or exists (
      select 1 from public.assignments a join public.generations g on g.id = a.generation_id
      where a.id = assignment_questions.assignment_id and g.user_id = auth.uid()
    )
  );

create policy "assignment_questions_insert_own" on public.assignment_questions
  for insert with check (
    exists (
      select 1 from public.assignments a join public.generations g on g.id = a.generation_id
      where a.id = assignment_questions.assignment_id and g.user_id = auth.uid()
    )
  );

create policy "assignment_questions_update_own_or_admin" on public.assignment_questions
  for update using (
    public.is_admin() or exists (
      select 1 from public.assignments a join public.generations g on g.id = a.generation_id
      where a.id = assignment_questions.assignment_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assignments a join public.generations g on g.id = a.generation_id
      where a.id = assignment_questions.assignment_id and g.user_id = auth.uid()
    )
  );

create policy "assignment_questions_delete_own_or_admin" on public.assignment_questions
  for delete using (
    public.is_admin() or exists (
      select 1 from public.assignments a join public.generations g on g.id = a.generation_id
      where a.id = assignment_questions.assignment_id and g.user_id = auth.uid()
    )
  );

create policy "quizzes_select_own_or_admin" on public.quizzes
  for select using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = quizzes.generation_id and g.user_id = auth.uid())
  );

create policy "quizzes_insert_own" on public.quizzes
  for insert with check (
    exists (select 1 from public.generations g where g.id = quizzes.generation_id and g.user_id = auth.uid())
  );

create policy "quizzes_update_own_or_admin" on public.quizzes
  for update using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = quizzes.generation_id and g.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.generations g where g.id = quizzes.generation_id and g.user_id = auth.uid())
  );

create policy "quizzes_delete_own_or_admin" on public.quizzes
  for delete using (
    public.is_admin() or exists (select 1 from public.generations g where g.id = quizzes.generation_id and g.user_id = auth.uid())
  );

create policy "quiz_questions_select_own_or_admin" on public.quiz_questions
  for select using (
    public.is_admin() or exists (
      select 1 from public.quizzes q join public.generations g on g.id = q.generation_id
      where q.id = quiz_questions.quiz_id and g.user_id = auth.uid()
    )
  );

create policy "quiz_questions_insert_own" on public.quiz_questions
  for insert with check (
    exists (
      select 1 from public.quizzes q join public.generations g on g.id = q.generation_id
      where q.id = quiz_questions.quiz_id and g.user_id = auth.uid()
    )
  );

create policy "quiz_questions_update_own_or_admin" on public.quiz_questions
  for update using (
    public.is_admin() or exists (
      select 1 from public.quizzes q join public.generations g on g.id = q.generation_id
      where q.id = quiz_questions.quiz_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quizzes q join public.generations g on g.id = q.generation_id
      where q.id = quiz_questions.quiz_id and g.user_id = auth.uid()
    )
  );

create policy "quiz_questions_delete_own_or_admin" on public.quiz_questions
  for delete using (
    public.is_admin() or exists (
      select 1 from public.quizzes q join public.generations g on g.id = q.generation_id
      where q.id = quiz_questions.quiz_id and g.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;

create policy "projects_select_own_or_admin" on public.projects
  for select using (user_id = auth.uid() or public.is_admin());

create policy "projects_insert_own" on public.projects
  for insert with check (user_id = auth.uid());

create policy "projects_update_own_or_admin" on public.projects
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "projects_delete_own_or_admin" on public.projects
  for delete using (user_id = auth.uid() or public.is_admin());

create policy "project_milestones_select_own_or_admin" on public.project_milestones
  for select using (
    public.is_admin() or exists (select 1 from public.projects p where p.id = project_milestones.project_id and p.user_id = auth.uid())
  );

create policy "project_milestones_insert_own" on public.project_milestones
  for insert with check (
    exists (select 1 from public.projects p where p.id = project_milestones.project_id and p.user_id = auth.uid())
  );

create policy "project_milestones_update_own_or_admin" on public.project_milestones
  for update using (
    public.is_admin() or exists (select 1 from public.projects p where p.id = project_milestones.project_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.projects p where p.id = project_milestones.project_id and p.user_id = auth.uid())
  );

create policy "project_milestones_delete_own_or_admin" on public.project_milestones
  for delete using (
    public.is_admin() or exists (select 1 from public.projects p where p.id = project_milestones.project_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RESUMES
-- ---------------------------------------------------------------------------
alter table public.resumes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.ats_checks enable row level security;

create policy "resumes_select_own_or_admin" on public.resumes
  for select using (user_id = auth.uid() or public.is_admin());

create policy "resumes_insert_own" on public.resumes
  for insert with check (user_id = auth.uid());

create policy "resumes_update_own_or_admin" on public.resumes
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "resumes_delete_own_or_admin" on public.resumes
  for delete using (user_id = auth.uid() or public.is_admin());

create policy "resume_versions_select_own_or_admin" on public.resume_versions
  for select using (
    public.is_admin() or exists (select 1 from public.resumes r where r.id = resume_versions.resume_id and r.user_id = auth.uid())
  );

create policy "resume_versions_insert_own" on public.resume_versions
  for insert with check (
    exists (select 1 from public.resumes r where r.id = resume_versions.resume_id and r.user_id = auth.uid())
  );

create policy "ats_checks_select_own_or_admin" on public.ats_checks
  for select using (
    public.is_admin() or exists (select 1 from public.resumes r where r.id = ats_checks.resume_id and r.user_id = auth.uid())
  );

create policy "ats_checks_insert_own" on public.ats_checks
  for insert with check (
    exists (select 1 from public.resumes r where r.id = ats_checks.resume_id and r.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RESEARCH PAPERS
-- ---------------------------------------------------------------------------
alter table public.research_papers enable row level security;

create policy "research_papers_select_own_or_admin" on public.research_papers
  for select using (user_id = auth.uid() or public.is_admin());

create policy "research_papers_insert_own" on public.research_papers
  for insert with check (user_id = auth.uid());

create policy "research_papers_update_own_or_admin" on public.research_papers
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "research_papers_delete_own_or_admin" on public.research_papers
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- TRENDING RESEARCH TOPICS  (public read, admin write)
-- ---------------------------------------------------------------------------
alter table public.trending_research_topics enable row level security;

create policy "trending_topics_select_authenticated" on public.trending_research_topics
  for select using (auth.role() = 'authenticated');

create policy "trending_topics_insert_admin" on public.trending_research_topics
  for insert with check (public.is_admin());

create policy "trending_topics_update_admin" on public.trending_research_topics
  for update using (public.is_admin()) with check (public.is_admin());

create policy "trending_topics_delete_admin" on public.trending_research_topics
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- INTERNSHIPS  (public read, admin write) + APPLICATIONS (owner only)
-- ---------------------------------------------------------------------------
alter table public.internships enable row level security;
alter table public.internship_applications enable row level security;

create policy "internships_select_authenticated" on public.internships
  for select using (auth.role() = 'authenticated');

create policy "internships_insert_admin" on public.internships
  for insert with check (public.is_admin());

create policy "internships_update_admin" on public.internships
  for update using (public.is_admin()) with check (public.is_admin());

create policy "internships_delete_admin" on public.internships
  for delete using (public.is_admin());

create policy "internship_applications_select_own_or_admin" on public.internship_applications
  for select using (user_id = auth.uid() or public.is_admin());

create policy "internship_applications_insert_own" on public.internship_applications
  for insert with check (user_id = auth.uid());

create policy "internship_applications_update_own_or_admin" on public.internship_applications
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "internship_applications_delete_own_or_admin" on public.internship_applications
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- SUBSCRIPTIONS & PAYMENTS  (read-only for the authenticated role; writes
-- come only from billing webhooks running under service_role, which
-- bypasses RLS entirely by default — so no write policy is granted here)
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;

create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "payment_transactions_select_own_or_admin" on public.payment_transactions
  for select using (
    public.is_admin() or exists (select 1 from public.subscriptions s where s.id = payment_transactions.subscription_id and s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- BOOKMARKS  (fully private, no admin bypass needed)
-- ---------------------------------------------------------------------------
alter table public.bookmarks enable row level security;

create policy "bookmarks_all_own" on public.bookmarks
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- STUDY SESSIONS  (fully private, no admin bypass needed)
-- ---------------------------------------------------------------------------
alter table public.study_sessions enable row level security;

create policy "study_sessions_all_own" on public.study_sessions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "notifications_select_own_or_admin" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications_delete_own" on public.notifications
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ADMIN AUDIT LOG  (admin-only, no policy at all for regular users)
-- ---------------------------------------------------------------------------
alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log_select_admin" on public.admin_audit_log
  for select using (public.is_admin());

create policy "admin_audit_log_insert_admin" on public.admin_audit_log
  for insert with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- STORAGE POLICIES
-- Convention: object path is always `${auth.uid()}/filename.ext`, so
-- ownership is enforced by checking the first path segment.
-- ---------------------------------------------------------------------------

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "uploads_bucket_owner_all" on storage.objects
  for all using (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes_bucket_owner_all" on storage.objects
  for all using (
    bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text
  );
