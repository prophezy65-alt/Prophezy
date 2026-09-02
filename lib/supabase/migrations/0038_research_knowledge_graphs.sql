-- ============================================================================
-- PROPHEZY — 0038_research_knowledge_graphs.sql
-- Purpose : Saved knowledge graphs built from a set of the student's papers
--           around a topic. Referenced throughout
--           lib/research/services/knowledge-graph.service.ts but the table
--           was never created — this is the direct cause of the 500 on
--           GET/POST /api/research/knowledge-graph.
-- Depends : 0003_profiles.sql
-- ============================================================================

create table if not exists public.research_knowledge_graphs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  topic      text not null,
  paper_ids  text[] not null default '{}',
  graph      jsonb not null default '{"nodes": [], "edges": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_research_knowledge_graphs_user_id
  on public.research_knowledge_graphs (user_id, created_at desc);

alter table public.research_knowledge_graphs enable row level security;

create policy "research_knowledge_graphs_select_own_or_admin" on public.research_knowledge_graphs
  for select using (user_id = auth.uid() or public.is_admin());

create policy "research_knowledge_graphs_insert_own" on public.research_knowledge_graphs
  for insert with check (user_id = auth.uid());

create policy "research_knowledge_graphs_delete_own_or_admin" on public.research_knowledge_graphs
  for delete using (user_id = auth.uid() or public.is_admin());

drop trigger if exists research_knowledge_graphs_touch on public.research_knowledge_graphs;
create trigger research_knowledge_graphs_touch before update on public.research_knowledge_graphs
  for each row execute function public.touch_updated_at();
