-- ============================================================================
-- PROPHEZY — 20260726000100_remove_placeholder_internships.sql
-- Purpose : Defensive cleanup. 0020_seed.sql inserted two fake internships
--           ("Acme Robotics", "Nimbus Cloud", source='seed') into the OLD
--           internships table shape. The later engine migration's
--           `drop table internships cascade` already wipes these on a
--           normal fresh-reset replay (0020 runs before it) — but that
--           file's own header explicitly warns "DO NOT run against
--           production", implying it may have been run out-of-order or
--           directly against a live database at some point. This is a
--           no-op if no such rows exist; harmless either way.
-- ============================================================================

delete from public.internships
where exists (
  select 1
  from jsonb_array_elements(sources) as src
  where src->>'provider' = 'seed'
);

-- Nothing else currently references source/provider tagging as 'seed' in
-- the new schema (`sources` is jsonb: an array of {provider, externalId,
-- url, fetchedAt} objects, per SourceRef in internship.types.ts — not a
-- plain text[] array), so this single statement is sufficient. See also:
-- 0020_seed.sql, updated separately to stop inserting placeholder
-- internships in future replays.
