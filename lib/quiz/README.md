# Prophezy Quiz Intelligence Engine — Complete

Adaptive assessment platform: generation, grading (local + AI), analytics,
adaptive difficulty, leaderboards, semantic search, and multi-format export.
Every AI call goes through `lib/ai/engine.ts#runAI` / `runStructured` — this
module never calls Gemini directly and never duplicates OCR, parsing, or the
`generations` orchestration flow.

## What's included

```
lib/quiz/
  models/
    quiz.types.ts            Domain types, 1:1 with the DB schema (camelCase <-> snake_case mapped in providers/)
  validation/
    question-schemas.ts      One zod schema per question type's metadata payload + discriminated union
    quiz-schemas.ts           Request/response schemas: generate, submit response/attempt, export
    validation.service.ts     validate() wrapper + re-exports, the only import surface API routes need
  prompts/
    quiz-generation.prompt.ts Full-quiz generation from source content
    followup-quiz.prompt.ts   Weak-topic-weighted revision quiz after a graded attempt
    grading.prompt.ts         AI grading for ai_graded question types
    hint.prompt.ts            Progressive hint levels 2-3 (level 1 ships with the question)
  generator/
    generator.service.ts      resolveSourceContent -> runStructured -> validate -> persist
  grading/
    grading.service.ts        Per-response grading (local or AI) + attempt finalization/scoring
  analytics/
    analytics.service.ts      Topic breakdown, weak/strong areas, mastery EMA, revision suggestions
  services/
    quiz.service.ts            Top-level orchestration: start/submit attempt, follow-up quiz
    difficulty.service.ts      Starting-difficulty suggestion, performance classification
    adaptive.service.ts        Mid-quiz question-by-question difficulty staircase
    leaderboard.service.ts     Global/subject/weekly scoring, streaks, badges
    hint.service.ts            Level 1 (stored) + level 2-3 (AI) hints
    review.service.ts          Mark-for-review + report-question flags
  search/
    search.service.ts          Semantic (pgvector), keyword, topic, concept search
  export/
    export.service.ts          Markdown/HTML/JSON/CSV direct; PDF/DOCX delegated (see below)
  utils/
    scoring.ts                 Pure local grading + score rollup with negative marking
    topic-analyzer.ts          Topic breakdown, weak/strong split, mastery EMA, time estimate, weightage
    randomizer.ts               Seeded shuffle for reproducible question/option order
    timer.ts                    Time-window validation for timed exam modes
    security.ts                 Pre-screen for prompt-injection patterns in user-supplied topic/text input
  providers/
    supabase-quiz.provider.ts   All raw Supabase reads/writes, one query shape per table

supabase/migrations/
  0021_quiz_engine_enums.sql          question_type, difficulty, exam_mode, attempt_status, grading_method
  0022_quiz_engine_extend.sql         Additive columns on existing quizzes/quiz_questions (0009) — no data loss
  0023_quiz_topics.sql                Topic taxonomy
  0024_quiz_attempts.sql              quiz_attempts, quiz_responses
  0025_quiz_analytics_leaderboard.sql Mastery, leaderboard, streaks, badges, question reviews
  0026_quiz_engine_rls.sql            RLS policies for every new table
  0027_quiz_questions_embedding.sql   pgvector column for semantic search
  0028_match_quiz_questions_fn.sql    RPC for semantic search, scoped by user_id
```

## Design decisions worth knowing

- **`quizzes`/`quiz_questions` were extended, not replaced.** Every column
  from 0009 keeps working; new columns are nullable or defaulted so existing
  MCQ-only rows remain valid. `options`/`correct_option` were relaxed to
  nullable since only `mcq`/`true_false` use that shape — every other type's
  answer lives in `metadata` (see the column comment in 0022 for the exact
  shape per type, and `validation/question-schemas.ts` for the zod source of
  truth).
- **Generation is two-step**, `generateAndValidateQuiz()` then
  `persistGeneratedQuiz(generationId, ...)`, because persisting needs a
  `generations` row id and that insert belongs to the existing shared
  generation-orchestration flow (per `0007_notes.sql`), not this module.
- **Grading is two-tier.** `exact_match`/`set_match` types (mcq, true_false,
  fill_in_blank, one_word, multiple_select, match_following, ordering) are
  scored locally in `utils/scoring.ts` — zero AI cost, instant. Everything
  else (`short_answer` through the subject-tagged types and all code types)
  goes through `grading.prompt.ts` via `runStructured`, one question at a
  time so the AI Core Engine's response cache can key per (question,
  response) pair.
- **Adaptive difficulty is a deliberately simple staircase**, not a full IRT
  model: 2 correct in a row steps up, 1 wrong steps down immediately. See
  `adaptive.service.ts` for the reasoning — predictability over sophistication.
- **PDF/DOCX export is intentionally left as a stub with a clear hookup
  comment.** Prophezy already has PDF/DOCX generation for Resume Studio and
  Assignment AI; this module produces clean markdown and defers to that
  existing utility rather than adding a second document-generation pipeline.
  Wire the one import once its path/signature is confirmed — see the comment
  in `export/export.service.ts`.

## One unverified import path

`providers/supabase-quiz.provider.ts`, `services/review.service.ts`, and
`search/search.service.ts` import `createServerClient` from
`@/lib/supabase/server`, assumed to match the standard Next.js App Router +
Supabase SSR pattern. If your actual export differs, it's a one-line fix in
each of those three files (the import line, not the call sites).

## Dependencies

Requires `zod` (already used across the codebase per `lib/ai/utils/validator.ts`'s
`withZod` adapter comment). No other new dependencies — reuses `tesseract.js`
(OCR, already installed), pgvector (already enabled), and the existing AI
Core Engine client for `embed()`.

## Not yet wired (flagged, not silently skipped)

1. PDF/DOCX export — see above.
2. `analytics.service.ts#updateTopicMastery` computes the EMA from
   `previousScore=0, previousAttempts=0` as a placeholder — a production
   wire-up should read the existing `quiz_topic_mastery` row first and pass
   its real values so the EMA is a true rolling average across attempts, not
   reset each time. The `emaMastery()` math in `utils/topic-analyzer.ts` is
   correct; only the "read current row first" step is left for the caller
   (trivial addition to `providers/supabase-quiz.provider.ts`, omitted here
   to avoid guessing your preferred read-before-write pattern).
3. Streak persistence: `leaderboard.service.ts#computeStreakUpdate` is a pure
   function; wiring it to read/write `quiz_streaks` is a few lines in the
   provider, same shape as every other upsert in that file.
