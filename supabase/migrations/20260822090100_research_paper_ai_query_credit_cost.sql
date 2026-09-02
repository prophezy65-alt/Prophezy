-- ============================================================================
-- PROPHEZY — 20260822090100_research_paper_ai_query_credit_cost.sql
-- Purpose : lib/research/services/chat.service.ts (and, after this audit,
--           summary.service.ts / citation.service.ts / knowledge-graph.service.ts
--           too) spend against feature key CREDIT_FEATURES.RESEARCH_PAPER_AI_QUERY
--           via getFeatureCreditCost(). 20260813120500_credit_system_feature_costs.sql
--           only seeded a 'research' row (8 credits, described as
--           "Research paper summary / citation extraction"), not a
--           'research_paper_ai_query' row — so unless CREDIT_FEATURES.
--           RESEARCH_PAPER_AI_QUERY happens to resolve to the exact string
--           'research', every one of those spend calls currently hits
--           "no active credit cost configured" (getFeatureCreditCost()
--           returns null) and throws before ever reaching Gemini. This
--           seeds the 2-credit cost described in the request ("Research
--           Paper AI query has an existing central credit cost of: 2
--           credits").
--
--           *** VERIFY BEFORE APPLYING ***: this assumes CREDIT_FEATURES.
--           RESEARCH_PAPER_AI_QUERY (lib/credits — not in the files
--           supplied for this audit) resolves to the string
--           'research_paper_ai_query', matching this project's existing
--           snake_case feature-key convention ('exam_predictor',
--           'flashcards', ...). If it resolves to something else, change
--           the `feature` value below to match before running this file —
--           otherwise it just adds an unused extra row and the underlying
--           "no active credit cost configured" error is unchanged.
-- Depends : 20260813120100_credit_system_tables.sql,
--           20260813120500_credit_system_feature_costs.sql
-- ============================================================================

insert into public.feature_credit_costs (feature, credit_cost, is_active, description) values
  ('research_paper_ai_query', 2, true, 'Research Paper AI query (chat / summary / citation extraction / knowledge graph) — per-call cost, distinct from the legacy unused "research" key.')
on conflict (feature) do update
  set credit_cost = excluded.credit_cost,
      is_active   = excluded.is_active,
      description = excluded.description,
      updated_at  = now();
