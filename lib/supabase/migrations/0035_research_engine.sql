-- ============================================================================
-- PROPHEZY — 0035_research_engine.sql
-- Purpose : Research AI module — links research_papers to the Document
--           Intelligence Engine (0022) for OCR/chunking/embeddings, adds
--           citation extraction + knowledge graph persistence.
-- Depends : 0012_research.sql, 0019_rls.sql, 0022_document_intelligence.sql,
--           0029_chat_enums.sql, 0030_chat_sessions_messages.sql
--
-- IMPORTANT — includes one shared-infra fix, not just additive Research
-- work: 0022_document_intelligence.sql created `documents`, `document_chunks`,
-- `document_embeddings`, `document_metadata`, `document_search_index`,
-- `document_analytics`, and `processed_files` but never enabled row level
-- security on any of them (0019_rls.sql predates 0022 and only covers the
-- OLD document_chunks table from 0006, which 0022 drops). As written, any
-- authenticated request can read/write every user's uploaded documents and
-- embeddings. Research AI is about to become the primary writer/reader of
-- these tables for uploaded papers, so shipping it on top of that gap would
-- mean shipping a real data leak. Fixing it here is strictly additive
-- (`enable row level security` + `create policy` only — no table/column
-- changes) and mirrors the exact "own_or_admin" pattern already used by
-- every other table in 0019_rls.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- RLS fix for the Document Intelligence Engine tables (0022)
-- ---------------------------------------------------------------------------

alter table public.documents enable row level security;

create policy "documents_select_own_or_admin" on public.documents
  for select using (user_id = auth.uid() or public.is_admin());

create policy "documents_insert_own" on public.documents
  for insert with check (user_id = auth.uid());

create policy "documents_update_own_or_admin" on public.documents
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "documents_delete_own_or_admin" on public.documents
  for delete using (user_id = auth.uid() or public.is_admin());

alter table public.document_metadata enable row level security;

create policy "document_metadata_select_own_or_admin" on public.document_metadata
  for select using (
    exists (select 1 from public.documents d where d.id = document_metadata.document_id
      and (d.user_id = auth.uid() or public.is_admin()))
  );

create policy "document_metadata_write_own" on public.document_metadata
  for all using (
    exists (select 1 from public.documents d where d.id = document_metadata.document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.documents d where d.id = document_metadata.document_id and d.user_id = auth.uid())
  );

alter table public.document_chunks enable row level security;

create policy "document_chunks_select_own_or_admin" on public.document_chunks
  for select using (
    exists (select 1 from public.documents d where d.id = document_chunks.document_id
      and (d.user_id = auth.uid() or public.is_admin()))
  );

create policy "document_chunks_write_own" on public.document_chunks
  for all using (
    exists (select 1 from public.documents d where d.id = document_chunks.document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.documents d where d.id = document_chunks.document_id and d.user_id = auth.uid())
  );

alter table public.document_embeddings enable row level security;

create policy "document_embeddings_select_own_or_admin" on public.document_embeddings
  for select using (
    exists (
      select 1 from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where c.id = document_embeddings.chunk_id and (d.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "document_embeddings_write_own" on public.document_embeddings
  for all using (
    exists (
      select 1 from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where c.id = document_embeddings.chunk_id and d.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where c.id = document_embeddings.chunk_id and d.user_id = auth.uid()
    )
  );

alter table public.document_search_index enable row level security;

create policy "document_search_index_select_own_or_admin" on public.document_search_index
  for select using (
    exists (select 1 from public.documents d where d.id = document_search_index.document_id
      and (d.user_id = auth.uid() or public.is_admin()))
  );

create policy "document_search_index_write_own" on public.document_search_index
  for all using (
    exists (select 1 from public.documents d where d.id = document_search_index.document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.documents d where d.id = document_search_index.document_id and d.user_id = auth.uid())
  );

alter table public.document_analytics enable row level security;

create policy "document_analytics_select_own_or_admin" on public.document_analytics
  for select using (
    exists (select 1 from public.documents d where d.id = document_analytics.document_id
      and (d.user_id = auth.uid() or public.is_admin()))
  );

create policy "document_analytics_insert_own" on public.document_analytics
  for insert with check (
    exists (select 1 from public.documents d where d.id = document_analytics.document_id and d.user_id = auth.uid())
  );

alter table public.processed_files enable row level security;

create policy "processed_files_select_own_or_admin" on public.processed_files
  for select using (
    exists (select 1 from public.documents d where d.id = processed_files.document_id
      and (d.user_id = auth.uid() or public.is_admin()))
  );

create policy "processed_files_write_own" on public.processed_files
  for all using (
    exists (select 1 from public.documents d where d.id = processed_files.document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.documents d where d.id = processed_files.document_id and d.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Link research_papers to the Document Intelligence Engine
-- ---------------------------------------------------------------------------

alter table public.research_papers
  add column document_id uuid references public.documents (id) on delete set null;

create index if not exists idx_research_papers_document_id on public.research_papers (document_id);
create index if not exists idx_research_papers_user_created on public.research_papers (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Citation / reference extraction
-- ---------------------------------------------------------------------------

create table public.research_citations (
  id           uuid primary key default gen_random_uuid(),
  paper_id     uuid not null references public.research_papers (id) on delete cascade,
  raw_text     text not null,
  title        text,
  authors      text[] not null default '{}',
  year         smallint,
  doi          text,
  url          text,
  source_page  integer,
  created_at   timestamptz not null default now()
);

create index idx_research_citations_paper_id on public.research_citations (paper_id);

comment on table public.research_citations is
  'Citations/references extracted (by Gemini, grounded in the paper text) from an uploaded or saved research paper.';

alter table public.research_citations enable row level security;

create policy "research_citations_select_own_or_admin" on public.research_citations
  for select using (
    exists (select 1 from public.research_papers p where p.id = research_citations.paper_id
      and (p.user_id = auth.uid() or public.is_admin()))
  );

create policy "research_citations_write_own" on public.research_citations
  for all using (
    exists (select 1 from public.research_papers p where p.id = research_citations.paper_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.research_papers p where p.id = research_citations.paper_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Knowledge graph (entities + relationships extracted across one or more papers)
-- ---------------------------------------------------------------------------

create table public.research_knowledge_graphs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  topic        text not null,
  paper_ids    uuid[] not null default '{}',
  -- { nodes: [{ id, label, type }], edges: [{ source, target, relation }] }
  graph        jsonb not null,
  created_at   timestamptz not null default now()
);

create index idx_research_knowledge_graphs_user_id on public.research_knowledge_graphs (user_id, created_at desc);

alter table public.research_knowledge_graphs enable row level security;

create policy "research_knowledge_graphs_select_own_or_admin" on public.research_knowledge_graphs
  for select using (user_id = auth.uid() or public.is_admin());

create policy "research_knowledge_graphs_insert_own" on public.research_knowledge_graphs
  for insert with check (user_id = auth.uid());

create policy "research_knowledge_graphs_delete_own_or_admin" on public.research_knowledge_graphs
  for delete using (user_id = auth.uid() or public.is_admin());
