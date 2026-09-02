-- ============================================================================
-- PROPHEZY — 0016_indexes.sql
-- Purpose : Every index that isn't already implied by a primary key or a
--           unique constraint declared inline in 0003–0015.
-- Depends : 0003_profiles.sql .. 0015_subscriptions.sql
-- ============================================================================

-- profiles
create index idx_profiles_role on public.profiles (role);

-- uploads
create index idx_uploads_user_id on public.uploads (user_id);
create index idx_uploads_status on public.uploads (status) where status <> 'ready';

-- document_chunks
create index idx_document_chunks_upload_id on public.document_chunks (upload_id);
create index idx_document_chunks_embedding on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- generations
create index idx_generations_user_id on public.generations (user_id, created_at desc);
create index idx_generations_upload_id on public.generations (upload_id);
create index idx_generations_kind on public.generations (kind);

-- flashcards
create index idx_flashcard_decks_generation_id on public.flashcard_decks (generation_id);
create index idx_flashcards_deck_id on public.flashcards (deck_id);
create index idx_flashcards_due_at on public.flashcards (due_at);
create index idx_flashcard_reviews_flashcard_id on public.flashcard_reviews (flashcard_id);

-- assignments / quizzes
create index idx_assignments_generation_id on public.assignments (generation_id);
create index idx_assignment_questions_assignment_id on public.assignment_questions (assignment_id);
create index idx_quizzes_generation_id on public.quizzes (generation_id);
create index idx_quiz_questions_quiz_id on public.quiz_questions (quiz_id);

-- projects
create index idx_projects_user_id on public.projects (user_id);
create index idx_projects_status on public.projects (status);
create index idx_project_milestones_project_id on public.project_milestones (project_id);

-- resumes
create index idx_resumes_user_id on public.resumes (user_id);
create index idx_resume_versions_resume_id on public.resume_versions (resume_id);
create index idx_ats_checks_resume_id on public.ats_checks (resume_id);

-- research
create index idx_research_papers_user_id on public.research_papers (user_id);
create index idx_research_papers_title_trgm on public.research_papers
  using gin (title extensions.gin_trgm_ops);

-- trending research topics
create index idx_trending_topics_trend_score on public.trending_research_topics (trend_score desc);
create index idx_trending_topics_field on public.trending_research_topics (field);

-- internships
create index idx_internships_type on public.internships (type);
create index idx_internships_deadline on public.internships (deadline_at);
create index idx_internship_applications_user_id on public.internship_applications (user_id);
create index idx_internship_applications_internship_id on public.internship_applications (internship_id);

-- subscriptions & billing
create index idx_subscriptions_status on public.subscriptions (status);
create index idx_payment_transactions_subscription_id on public.payment_transactions (subscription_id);

-- bookmarks
create index idx_bookmarks_user_id on public.bookmarks (user_id);
create index idx_bookmarks_entity on public.bookmarks (entity_type, entity_id);

-- study sessions
create index idx_study_sessions_user_id on public.study_sessions (user_id, started_at desc);

-- notifications
create index idx_notifications_user_unread on public.notifications (user_id, is_read)
  where is_read = false;

-- admin audit log
create index idx_admin_audit_log_admin_id on public.admin_audit_log (admin_id, created_at desc);
