-- ============================================================================
-- PROPHEZY — 20260817090000_credit_system_exam_predictor_connected.sql
-- Purpose : Exam Predictor is now actually connected (lib/syllabus/services/
--           paper-predictor.service.ts#predictPaper). The row seeded in
--           20260813120500 said "no AI service exists in lib/ yet" — that
--           was true at the time but is stale now. Description-only fix;
--           cost (4 credits) and is_active are unchanged.
-- Depends : 20260813120500_credit_system_feature_costs.sql
-- ============================================================================

update public.feature_credit_costs
set description = 'Exam question prediction from syllabus (lib/syllabus/services/paper-predictor.service.ts#predictPaper).',
    updated_at = now()
where feature = 'EXAM_PREDICTOR';
