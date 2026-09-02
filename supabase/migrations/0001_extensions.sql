-- ============================================================================
-- PROPHEZY — 0001_extensions.sql
-- Purpose : Enable every Postgres extension the rest of the schema depends on.
--           This migration ONLY enables extensions — no types, tables,
--           indexes, functions, triggers, or RLS.
-- Depends : nothing (must always be migration #1, run first, on its own)
-- ============================================================================

-- pgcrypto -> gen_random_uuid(), digest(), crypt() for any hashing needs
create extension if not exists "pgcrypto" with schema extensions;

-- vector -> pgvector, required later by document_chunks.embedding (RAG search)
create extension if not exists "vector" with schema extensions;

-- pg_trgm -> trigram indexes for fuzzy / ILIKE search (notes, resumes, research titles)
create extension if not exists "pg_trgm" with schema extensions;

-- unaccent -> accent-insensitive search on user-entered names/colleges/titles
create extension if not exists "unaccent" with schema extensions;

-- citext -> case-insensitive text type, used for emails and unique slugs
create extension if not exists "citext" with schema extensions;