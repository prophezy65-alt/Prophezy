# Prophezy — Flashcards Intelligence Engine

Adaptive, AI-generated, spaced-repetition flashcards. Every AI call goes
through the existing `lib/ai/engine.ts` (`runAI`) — this module never calls
Gemini directly, per the project's AI Core Engine convention.

## What's included

```
lib/flashcards/
  models/         Flashcard, FlashcardDeck, FlashcardReview, FlashcardSchedule,
                   FlashcardAnalytics, Concept/Topic, Difficulty, StudySession
  validation/      Zod schemas, upload/injection sanitization, validation.service.ts
  scheduler/       sm2.ts, leitner.ts, scheduler.service.ts (queues, daily/weekly/monthly)
  prompts/         flashcards.prompts.ts — 8 specialized generation prompts +
                   mnemonic/hint prompts, all as PromptDefinition
  providers/       ocr.provider.ts, ingestion.provider.ts (14 input types)
  generator/       card-generator.ts, concept-extractor.ts, duplicate-detector.ts,
                   deck-builder.ts
  services/        flashcards, generator, review, analytics, difficulty, concept,
                   keyword, hint, mnemonic, search, export, validation, _run-structured
  analytics/       re-exports services/analytics.service.ts (spec folder layout)
  search/          re-exports services/search.service.ts (spec folder layout)
  export/          formatters.ts (md/json/csv/txt/html/anki) + service barrel
  utils/           text-chunker.ts, format-date.ts

supabase/migrations/
  0021_flashcards_metadata.sql   ADDITIVE ONLY — see below
```

## The one schema decision I made — read this first

Your real `0008_flashcards.sql` only has `flashcard_decks`, `flashcards`
(front/back + SM-2 columns), and `flashcard_reviews`. The spec asks for 19+
card types, tags, concepts/topics, mnemonics, hints, difficulty, confidence,
analytics, study sessions, and embeddings for semantic search — none of
which have columns to live in on the existing tables.

Since the instruction was "do not modify schema" for the *complete* modules
but this Flashcards Engine *is* the module being built, I added
`0021_flashcards_metadata.sql`:

- **Nullable/defaulted columns added to `flashcards`**: `card_type`, `tags`,
  `hint`, `mnemonic`, `explanation`, `difficulty`, `confidence`,
  `source_excerpt`, `image_url`, `metadata`, `embedding vector(768)`,
  `duplicate_of`.
- **Nullable/defaulted columns added to `flashcard_decks`**: `learning_mode`,
  `source_type`, `source_ref`, `metadata`.
- **Two new tables** (nothing existing touched): `flashcard_concepts`
  (concepts/topics/keywords per deck) and `flashcard_study_sessions`
  (streaks/time-studied analytics).

Nothing in 0008 is altered, renamed, or dropped. If you'd rather I not add
this migration at all, say so and I'll rework the models to encode
`card_type`/`tags`/etc. into the existing `metadata`-less schema via a single
JSON blob smuggled into... nowhere, honestly — there's no spare column, so
some additive change is unavoidable for this feature set. This was the
narrowest one I could make.

**Also needed, not yet created**: a `match_flashcards` Postgres function for
pgvector cosine search (`search.service.ts` calls it via `.rpc()` — Supabase's
JS client can't express `<=>` ordering directly). The exact SQL is
documented as a comment right above that call site.

## Things I built against a documented assumption, not your actual code

You shared `engine.ts` and `_shared.ts` in full, and the real `0008` schema —
everything built on those three is solid. Three integration points I didn't
have source for are clearly flagged in-file with `ASSUMPTION` / `WIRING
NOTE` comments and, where getting it wrong would mean silently fabricating
data, they **throw instead of faking a result**:

| File | What's assumed | Fix |
|---|---|---|
| `providers/ocr.provider.ts` | Real `ocr.service.ts` export name/shape | One import line |
| `providers/ingestion.provider.ts` | PDF/DOCX/PPTX/ZIP extractor function names on `lib/ai/utils/parser.ts` | Three import lines |
| `services/flashcards.service.ts`, all Supabase-touching services | `getSupabaseServerClient()` at `@/lib/supabase/server` | One import line, everywhere it's used |
| `services/_run-structured.ts` | Your existing `_run-structured.ts`'s exact shape (README describes it but you didn't share it) | Delete this file, import yours — same `runStructured()` signature is depended on everywhere |
| `services/export.service.ts` (pdf/docx cases) | Reuses Resume Studio's PDF/DOCX builders | Wire two function calls; markdown/json/csv/txt/html/anki are fully implemented, no stubs |

Nothing else in the codebase is a stub — SM-2, Leitner, dedup, search,
export formatting, analytics math, and all 8 generation prompts are real,
working logic.

## Spaced repetition

- **SM-2** (`scheduler/sm2.ts`): standard algorithm operating directly on
  `ease_factor` / `interval_days` / `repetitions` / `due_at` — no new
  columns needed for this part, they were already in 0008.
- **Leitner** (`scheduler/leitner.ts`): a 5-box view *derived* from SM-2
  state (never stored separately, so it can't drift out of sync).
- **Queues** (`scheduler/scheduler.service.ts`): due/learning/new-card
  queues, daily/weekly/monthly views, and adaptive new-card intake based on
  recent retention rate.

## Card generation flow

`generator.service.ts` is the single entry point:

```
ingestDocument()        -> normalizes any of the 14 input types to plain text
generateCards()         -> picks the right specialized prompt, calls runAI via _run-structured
buildDeck()             -> dedupes lexically similar cards, merges AI + local concepts
flashcardsService.*     -> persists deck + cards
conceptService.*        -> persists extracted concepts, links to cards
```

Example route usage:

```ts
import { generatorService } from "@/lib/flashcards";

const result = await generatorService.generateDeck({
  generationId,
  userId,
  sourceType: "pdf",
  sourceRef: uploadedFilePath,
  learningMode: "exam",
  targetCardCount: 40,
});
```

## Security

- `validation/sanitize.ts` — file extension/MIME/size checks, zip-bomb guard,
  and an injection-pattern flag on ingested document text (defense in depth
  on top of the AI Core Engine's own `middleware/safety.ts`, which still
  runs on every `runAI` call).
- All external inputs are Zod-validated in `validation/schemas.ts` before
  touching a service.

## Not built / explicitly out of scope

- `.apkg` (SQLite-packaged) Anki export — the tab-separated Anki-import
  format is implemented instead; true `.apkg` needs an embedded SQLite +
  zip writer, which is a meaningfully separate piece of infra.
- PDF/DOCX export bodies (see wiring table above).
- ZIP archive expansion (needs a storage-aware unzip utility not present in
  anything you've shared — throws with a clear message rather than faking
  file listings).
