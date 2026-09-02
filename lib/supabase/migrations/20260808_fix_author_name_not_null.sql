-- Fixes: "null value in column author_name ... violates not-null constraint"
-- seen when running blog_seed_batch2.sql / blog_seed_product.sql /
-- blog_seed_coverage.sql.
--
-- Root cause: blog_posts.author_name was defined `not null` in the original
-- schema (20260807_blog_schema.sql), back when there was no blog_authors
-- table yet. Once 20260807b_blog_expansion.sql introduced blog_authors +
-- author_id as the real source of truth, every insert since (batch2,
-- product, coverage) stopped setting author_name — it's now redundant,
-- kept only as a display fallback in the query layer (see
-- lib/blog/queries.ts: `row.author?.name ?? row.author_name`). The column
-- itself was never updated to allow that.
--
-- Run this once, then re-run blog_seed_coverage.sql (and batch2/product
-- too, if they also failed) — they're all idempotent (on conflict upserts),
-- safe to re-run in full.

alter table blog_posts alter column author_name drop not null;
