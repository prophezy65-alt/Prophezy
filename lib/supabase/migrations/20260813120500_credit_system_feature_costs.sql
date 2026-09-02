-- ============================================================================
-- PROPHEZY — 20260813120500_credit_system_feature_costs.sql
-- Purpose : Phase 2B Central Credit System — step 6 of 6.
--           Seeds public.feature_credit_costs (created empty in
--           20260813120100_credit_system_tables.sql) with the proposed
--           per-feature costs, confirmed in chat. Keyed off
--           lib/ai/config/models.ts FEATURE_MODEL_MAP, priced roughly by
--           model tier (flash-lite < flash < pro-preview), plus
--           'exam_predictor' (new feature, not yet in FEATURE_MODEL_MAP).
--
--           This migration only seeds data — it does NOT wire any AI
--           feature to actually call spend_credits() yet. No feature
--           service file (lib/ai/services/*.service.ts) is touched here.
--           Connecting a feature means calling
--           spendCreditsForFeature(userId, cost, feature, () => ...) from
--           that feature's route/service entry point — a separate,
--           explicit follow-up per feature.
--
--           Costs are just data in a table: adjust anytime with a plain
--           UPDATE, no code deploy or new migration required.
-- Depends : 20260813120100_credit_system_tables.sql
-- ============================================================================

insert into public.feature_credit_costs (feature, credit_cost, is_active, description) values
  ('flashcards',      2, true, 'Flashcard deck generation (gemini-3.5-flash-lite).'),
  ('quiz',            2, true, 'Quiz generation (gemini-3.5-flash-lite).'),
  ('notes',           3, true, 'Notes/revision-notes/mind-map style generation (gemini-3.6-flash).'),
  ('mindmap',         3, true, 'Mind map generation (gemini-3.6-flash).'),
  ('ocr',             3, true, 'OCR extraction (gemini-3.6-flash).'),
  ('ats',             3, true, 'ATS resume scan (gemini-3.6-flash).'),
  ('resume',          4, true, 'Resume build/rewrite (gemini-3.6-flash).'),
  ('project',         4, true, 'Project generator (gemini-3.6-flash).'),
  ('humanizer',       4, true, 'Humanizer rewrite (gemini-3.6-flash).'),
  ('interview',       5, true, 'Mock interview — cost per candidate turn, not per session (gemini-3.1-pro-preview).'),
  ('exam_predictor',  5, true, 'Exam question prediction from syllabus (new feature, not yet in FEATURE_MODEL_MAP).'),
  ('research',        8, true, 'Research paper summary / citation extraction (gemini-3.1-pro-preview).'),
  ('assignment',      8, true, 'Assignment solving engine (gemini-3.1-pro-preview).'),
  ('roadmap',         8, true, 'Career roadmap generation (gemini-3.1-pro-preview).')
on conflict (feature) do update
  set credit_cost = excluded.credit_cost,
      is_active   = excluded.is_active,
      description = excluded.description,
      updated_at  = now();
