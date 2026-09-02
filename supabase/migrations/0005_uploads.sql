-- ============================================================================
-- PROPHEZY — 0005_uploads.sql
-- Purpose : Every file a student uploads (source PDFs, syllabi, resume source
--           docs). Feeds document_chunks (0006) and generations (0007).
-- Depends : 0002_enums.sql, 0003_profiles.sql, 0004_storage.sql
-- ============================================================================

create table public.uploads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  bucket_id       text not null default 'uploads' references storage.buckets (id),
  storage_path    text not null,
  file_name       text not null,
  file_type       text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  page_count      smallint,
  status          public.upload_status not null default 'pending',
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (bucket_id, storage_path)
);

comment on table public.uploads is
  'Raw files a student uploads. status tracks the ingestion pipeline: pending -> processing -> ready|failed.';
