-- ============================================================================
-- PROPHEZY — 0036_research_papers_document_link.sql
-- Purpose : research_papers.document_id was referenced throughout
--           lib/research/services/{ingest,paper,chat}.service.ts (linking a
--           paper to its processed lib/document/ record — OCR text, chunks,
--           embeddings) but was never actually added to the schema. This is
--           the direct cause of the 500 on GET /api/research/papers and the
--           upload failing to complete: every insert/select touching this
--           column errored at the database level.
-- Depends : 0012_research.sql, 0022_document_intelligence.sql
-- ============================================================================

alter table public.research_papers
  add column if not exists document_id uuid references public.documents (id) on delete set null;

create index if not exists idx_research_papers_document_id
  on public.research_papers (document_id);
