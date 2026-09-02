-- Renumber to match your real supabase/migrations sequence before applying.
--
-- Persists Project Generator output (built from lib/project-generator/models
-- + services already in the codebase). Stored as JSONB per-artifact rather
-- than normalized, since each artifact (ProjectSpec, DatabaseSchema,
-- ApiDesign, Roadmap, DiagramSet, DeploymentPlan, TestingPlan, SecurityPlan,
-- ProjectEstimation) already has its own validated TypeScript shape from
-- lib/project-generator/models/ — normalizing into dozens of extra tables
-- would duplicate that validation for no query benefit, since the app only
-- ever reads/writes one full project at a time.

create table if not exists project_generator_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,

  title text not null,
  tagline text,
  description text,
  domains text[] not null default '{}',
  difficulty_score smallint,
  complexity_score smallint,
  scale text,

  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'failed')),
  error_message text,

  -- Raw JSON of each lib/project-generator/models artifact. Null until that
  -- pipeline step completes (see generation-orchestrator.service.ts).
  spec jsonb,
  database_schema jsonb,
  api_design jsonb,
  roadmap jsonb,
  diagrams jsonb,
  deployment_plan jsonb,
  testing_plan jsonb,
  security_plan jsonb,
  estimation jsonb,
  export_bundle_path text,

  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),

  github_repo_url text,
  demo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_generator_projects_user_idx on project_generator_projects (user_id);
create index if not exists project_generator_projects_status_idx on project_generator_projects (status);
create index if not exists project_generator_projects_favorite_idx on project_generator_projects (user_id, is_favorite) where is_favorite = true;
create index if not exists project_generator_projects_domains_gin_idx on project_generator_projects using gin (domains);
create index if not exists project_generator_projects_title_trgm_idx on project_generator_projects using gin (title gin_trgm_ops);

create extension if not exists pg_trgm;

create or replace function project_generator_projects_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists project_generator_projects_touch_updated_at on project_generator_projects;
create trigger project_generator_projects_touch_updated_at
  before update on project_generator_projects
  for each row
  execute function project_generator_projects_set_updated_at();

alter table project_generator_projects enable row level security;

create policy "Users can view their own projects"
  on project_generator_projects for select
  using (user_id = auth.uid());

create policy "Users can insert their own projects"
  on project_generator_projects for insert
  with check (user_id = auth.uid());

create policy "Users can update their own projects"
  on project_generator_projects for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own projects"
  on project_generator_projects for delete
  using (user_id = auth.uid());

-- Milestone completion state (user checking off roadmap tasks). The
-- roadmap CONTENT (task list, phases) lives in project_generator_projects.roadmap
-- (JSONB, generated once); this table only tracks per-task completion,
-- which changes independently and shouldn't require rewriting the whole
-- roadmap JSON blob on every checkbox click.
create table if not exists project_generator_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_generator_projects(id) on delete cascade,
  task_id text not null, -- matches a RoadmapTask.id from the roadmap JSONB
  completed boolean not null default false,
  completed_at timestamptz,

  unique (project_id, task_id)
);

create index if not exists project_generator_milestones_project_idx on project_generator_milestones (project_id);

alter table project_generator_milestones enable row level security;

create policy "Users can manage milestones for their own projects"
  on project_generator_milestones for all
  using (
    exists (
      select 1 from project_generator_projects
      where project_generator_projects.id = project_generator_milestones.project_id
        and project_generator_projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from project_generator_projects
      where project_generator_projects.id = project_generator_milestones.project_id
        and project_generator_projects.user_id = auth.uid()
    )
  );
