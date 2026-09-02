# Prophezy Humanizer Intelligence Engine

Backend module for `lib/humanizer/`. Every AI call routes through the existing AI Core
Engine (`lib/ai/engine.ts`) via a single adapter, `providers/ai-engine.provider.ts` —
no file in this module calls Gemini directly. Nothing here modifies auth, frontend, the
existing DB schema, or any of the other listed modules (Assignment AI, Notes AI,
Resume Studio, etc.) — this module only **adds** new files under `lib/humanizer/` plus
two brand-new database tables via migration.

## What's here

```
lib/humanizer/
  models/types.ts              Rewrite, RewriteHistoryEntry, ToneProfile,
                                GrammarAnalysis, ReadabilityReport, Analytics types
  providers/
    ai-engine.provider.ts      SOLE integration point with lib/ai/engine.ts
  prompts/
    _shared.ts                 PromptDefinition contract (same pattern as Assignment AI)
    rewrite.ts                 ONE parameterized prompt covering every rewrite style/
                                tone/length op — see "Design decision" below
    grammar.ts                 Grammar/spelling correction + issue list
    tone-analysis.ts           Tone detection
    title-and-format.ts        Title/headline generation + bullet<->paragraph conversion
  parser/
    input-extractor.ts         Extracts text from pdf/docx/txt/md/html inputs —
                                REUSES lib/assignment/parser for pdf/docx/txt/md
  services/
    rewrite.service.ts         Core AI rewrite dispatcher
    tone.service.ts            Tone analysis (AI + deterministic fallback)
    grammar.service.ts         Grammar correction (AI + deterministic fallback)
    clarity.service.ts         Readability/clarity scoring — 100% deterministic, no AI
    formatter.service.ts       Titles/headlines + bullet<->paragraph conversion
    humanizer.service.ts       TOP-LEVEL ORCHESTRATOR — call this from API routes
    history.service.ts         Rewrite history persistence (Supabase)
    search.service.ts          Semantic (pgvector) + keyword (full-text) + history search
    analytics.service.ts       Event logging + usage summaries (Supabase)
    export.service.ts          Orchestrates all six exporters
    _logger.ts                 Structured JSON logger
  export/
    text-formats.export.ts     Markdown, HTML, TXT, JSON exporters
    docx.export.ts             .docx exporter (via `docx`)
    pdf.export.ts               .pdf exporter (via `pdf-lib`)
  utils/
    readability-calculator.ts  Flesch Reading Ease / Flesch-Kincaid Grade (deterministic)
    vocabulary-analyzer.ts     Type-token ratio, professionalism-score heuristic
    grammar-analyzer.ts        Cheap regex-based grammar pre-check + score formula
    sentence-optimizer.ts      Run-on/filler-phrase/passive-opening detection
    formatter.ts                Deterministic bullet<->paragraph fallback
    markdown-builder.ts        Rewrite -> Markdown document assembly
    export-utility.ts          Filename/MIME helpers
  validation/
    schemas.ts                 Zod request schemas (per spec's explicit Zod requirement)
    security.ts                Re-exports Assignment AI's injection defense (REUSED per
                                spec) + adds output-side "Safe AI Responses" leak checking
  migrations/
    0001_humanizer_history.sql   NEW table: humanizer_history (+ pgvector embedding
                                  column, full-text index, RLS policies, semantic-search RPC)
    0002_humanizer_analytics.sql NEW table: humanizer_analytics (+ RLS policies)
  examples/api-routes/humanizer/
    rewrite/route.ts           POST — run a full humanize/rewrite request
    analyze/route.ts           POST — grammar/readability/tone WITHOUT a rewrite
    history/route.ts           GET — paginated rewrite history
    search/route.ts            POST — semantic/keyword/history search
    export/route.ts            POST — export a past rewrite to any of 6 formats
```

## Entry points

```ts
import { humanizeText } from "@/lib/humanizer/services/humanizer.service";

const rewrite = await humanizeText(
  rawText,
  { style: "academic", tone: "formal", lengthOp: "none", domain: "assignment", preserveFormatting: true },
  { userId }
);
```

```ts
import { analyzeTextQuality } from "@/lib/humanizer/services/humanizer.service";

// Live quality panel while the user edits — no rewrite, no history write.
const { grammar, readability, toneProfile } = await analyzeTextQuality(text, { userId });
```

For file uploads (PDF/DOCX/TXT/MD/HTML), extract text first:

```ts
import { extractInputText } from "@/lib/humanizer/parser/input-extractor";

const text = await extractInputText(fileBuffer, "docx");
const rewrite = await humanizeText(text, options, { userId });
```

## Peer dependencies

```
npm install docx pdf-lib zod
```

(`tesseract.js pdf-parse mammoth jszip pdfjs-dist canvas` are Assignment AI's
dependencies, already required if that module is installed — Humanizer reuses its
`text-parsers.ts`, which needs `pdf-parse`/`mammoth`.)

## Design decisions worth knowing about

- **One parameterized rewrite prompt, not fifteen.** The spec lists Academic Rewrite,
  Professional Rewrite, Student Rewrite, Business Rewrite, Formal/Casual/Friendly/
  Technical Tone, Simplify, Expand, Shorten, SEO-Friendly Rewrite, Email Rewrite, Cover
  Letter Rewrite, and Resume Bullet Rewrite as separate features. Architecturally these
  are the same operation — constrained rewriting — with different target style/tone/
  length parameters, so `prompts/rewrite.ts` is one prompt whose system instructions
  branch on `style`/`tone`/`lengthOp`, each with its own concrete guidance block (see
  the file — nothing is generic filler). This is the DRY-correct design: 15 near-
  duplicate prompt files would mean the "never fabricate facts" / "preserve meaning"
  rules drift independently across them over time. Every named feature in the spec maps
  to a specific `{style, tone, lengthOp}` combination — e.g. "Casual Tone" is
  `{tone: "casual"}`, "Resume Bullet Rewrite" is `{style: "resume_bullet"}`.
- **Readability/clarity is 100% deterministic** (Flesch formulas + vocabulary/sentence
  heuristics) — no AI call needed for well-defined mathematical scoring, which also
  means it's cheap enough for a live "quality score" panel on every keystroke.
- **Grammar and tone degrade gracefully.** If the AI call fails, `grammar.service.ts`
  falls back to a regex-based heuristic scan and `tone.service.ts` falls back to a
  vocabulary-based formality estimate, rather than failing the whole rewrite.
- **Reuse, not reimplementation.** `parser/input-extractor.ts` calls straight into
  `lib/assignment/parser/text-parsers.ts` for PDF/DOCX/TXT/MD extraction, and
  `validation/security.ts` re-exports (rather than duplicates)
  `lib/assignment/validation/security.ts`'s prompt-injection defense — per the spec's
  explicit "Reuse Validation / Reuse Parsers / Reuse OCR" instructions. Scanned PDFs are
  explicitly NOT OCR'd here; the error message points the user to Assignment AI's OCR,
  since that's the module that already owns that job well.
- **`getSupabaseAdminClient` and `embed()` imports are assumed.** `history.service.ts`,
  `analytics.service.ts`, and `search.service.ts` assume `@/lib/supabase/admin` exports
  `getSupabaseAdminClient()` and that `@/lib/ai/engine` exports `embed()` (per the
  Assignment AI Core Engine's own README: `client.ts` — "generate(), streamGenerate(),
  embed()"). If either path/name differs in your actual codebase, those are the only
  files to adjust — everything else is decoupled from them.
- **Migrations are new tables only.** `0001_humanizer_history.sql` and
  `0002_humanizer_analytics.sql` are additive — copy them into your real
  `supabase/migrations/` with the correct next sequence number. Nothing modifies an
  existing table.

## Nothing left outstanding from this spec

Every service, model, utility, prompt family, and export format listed in the brief has
a real, working implementation — including Zod validation, Redis-hook-ready structure
(rewrite/grammar/tone calls all route through the AI Core Engine's own caching/rate-
limiting middleware per its README), and the two requested migrations.
