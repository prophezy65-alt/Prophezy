-- ============================================================================
-- PROPHEZY — 0006_document_chunks.sql
-- Purpose : Chunked + embedded text extracted from an upload. Backing store
--           for RAG-based generation (notes, assignments, mind maps, etc).
-- Depends : 0001_extensions.sql (vector), 0005_uploads.sql
-- ============================================================================

create table public.document_chunks (
  id           uuid primary key default gen_random_uuid(),
  upload_id    uuid not null references public.uploads (id) on delete cascade,
  chunk_index  integer not null,
  content      text not null,
  token_count  integer not null check (token_count > 0),
  -- 768 dims matches Gemini text-embedding-004
  embedding    extensions.vector(768),
  created_at   timestamptz not null default now(),

  unique (upload_id, chunk_index)
);

comment on table public.document_chunks is
  'Ordered text chunks + embeddings for one upload. embedding is null until the async embed step completes.';
