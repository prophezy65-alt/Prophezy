-- ============================================================================
-- PROPHEZY — 0020_seed.sql
-- Purpose : Local/dev seed data only. Nothing here depends on auth.users, so
--           it is safe to run against a fresh `supabase db reset` without an
--           already-signed-up user. DO NOT run against production.
-- Depends : 0013_research_topics.sql
-- ============================================================================
--
-- NOTE: this file used to also insert two placeholder internships ("Acme
-- Robotics", "Nimbus Cloud") directly into `internships`. That table was
-- later dropped and rebuilt with a different shape by
-- 20260723090000_internship_engine.sql, and the pipeline now populates real
-- internships via the provider sync (Adzuna, Jooble, Greenhouse, Lever,
-- Ashby, RemoteOK, Remotive, etc.) — see `npm run internships:sync`. Seeding
-- fake internships here would just create-then-immediately-orphan rows on a
-- fresh reset and has been removed. See also:
-- 20260726000100_remove_placeholder_internships.sql, which cleans up any
-- such rows that may already exist from before this fix.

insert into public.trending_research_topics (title, field, summary, source_url, trend_score, published_at)
values
  ('Retrieval-Augmented Generation for Low-Resource Languages', 'NLP',
   'Techniques for improving RAG pipelines when training data is scarce.',
   'https://arxiv.org', 92.5, current_date - interval '10 days'),
  ('Energy-Efficient Transformer Inference', 'Machine Learning Systems',
   'Quantization and pruning approaches for running LLMs on edge devices.',
   'https://arxiv.org', 88.0, current_date - interval '5 days'),
  ('Federated Learning for Healthcare Data', 'AI in Healthcare',
   'Privacy-preserving model training across hospital networks.',
   'https://arxiv.org', 81.3, current_date - interval '20 days');
