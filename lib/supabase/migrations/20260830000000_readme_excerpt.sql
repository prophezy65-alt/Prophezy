-- Adds a column for a verbatim README excerpt -- the project's own real
-- description, not an AI-written summary. Nullable: rows without a
-- fetched excerpt yet simply show nothing extra (existing "Overview" =
-- GitHub's short description continues to work as before).

alter table public.project_library add column if not exists readme_excerpt text;
alter table public.project_library add column if not exists readme_images text[] not null default '{}';

comment on column public.project_library.readme_excerpt is
  'Verbatim excerpt from the repository''s own README (trimmed of badges/images only, never reworded or summarized). Populated by scripts/fetch-readme-excerpts.py -- not by AI.';

comment on column public.project_library.readme_images is
  'Real image URLs (screenshots/demos) the project''s own README author embedded -- never a fabricated or stock image. Badge/CI-status icons are excluded. Populated by scripts/fetch-readme-excerpts.py -- not by AI.';
