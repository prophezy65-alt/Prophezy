-- ============================================================================
-- PROPHEZY — 00226_document_intelligence_rls.sql
-- Purpose : Row-level security for every table introduced by
--           0022_document_intelligence.sql. That migration never defined
--           any policies for these tables, so every insert/select was being
--           denied outright once RLS was enforced on them. Ownership flows
--           through user_id directly on `documents`, or through a join up
--           to `documents` where it isn't (everything else), matching the
--           same pattern as 0026_quiz_engine_rls.sql.
-- Depends : 0022_document_intelligence.sql
-- ============================================================================

alter table public.documents             enable row level security;
alter table public.document_metadata     enable row level security;
alter table public.document_chunks       enable row level security;
alter table public.document_embeddings   enable row level security;
alter table public.document_search_index enable row level security;
alter table public.document_analytics    enable row level security;
alter table public.processed_files       enable row level security;

-- documents: owned directly by user_id
create policy documents_owner_all on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- document_metadata: 1:1 with documents, ownership via parent document
create policy document_metadata_owner_all on public.document_metadata
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_metadata.document_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_metadata.document_id and d.user_id = auth.uid()
    )
  );

-- document_chunks: ownership via parent document
create policy document_chunks_owner_all on public.document_chunks
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id and d.user_id = auth.uid()
    )
  );

-- document_embeddings: one hop further — ownership via parent chunk's document
create policy document_embeddings_owner_all on public.document_embeddings
  for all using (
    exists (
      select 1 from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where c.id = document_embeddings.chunk_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where c.id = document_embeddings.chunk_id and d.user_id = auth.uid()
    )
  );

-- document_search_index: ownership via parent document
create policy document_search_index_owner_all on public.document_search_index
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_search_index.document_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_search_index.document_id and d.user_id = auth.uid()
    )
  );

-- document_analytics: ownership via parent document
create policy document_analytics_owner_all on public.document_analytics
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_analytics.document_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_analytics.document_id and d.user_id = auth.uid()
    )
  );

-- processed_files: ownership via parent document
create policy processed_files_owner_all on public.processed_files
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = processed_files.document_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = processed_files.document_id and d.user_id = auth.uid()
    )
  );
