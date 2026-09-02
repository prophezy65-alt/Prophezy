-- ============================================================================
-- PROPHEZY — 0018_triggers.sql
-- Purpose : Wire the functions from 0017_functions.sql onto their tables.
-- Depends : 0017_functions.sql, every table migration (0003–0015)
-- ============================================================================

-- auth.users -> profiles + subscriptions bootstrap
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance, one trigger per table that has the column
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.uploads
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.generations
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.flashcard_decks
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.flashcards
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.quizzes
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.project_milestones
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.research_papers
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.trending_research_topics
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.internships
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.internship_applications
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
