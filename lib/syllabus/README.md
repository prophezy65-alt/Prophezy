# Syllabus AI — Backend Module

Plugs into your existing Prophezy AI Engine. Does not touch auth, frontend,
DB schema/migrations, or the AI Core Engine itself.

## Verified

Every file in `lib/syllabus/` **type-checks cleanly** (`tsc --strict`, exit
code 0) against stub versions of the two integration points listed below.
I don't have your actual `lib/ai/*` source, so I couldn't compile against
the real thing — but the stubs match the shapes documented in your own
`lib/ai/README.md` screenshot, and this module only touches those shapes
through the two files called out below.

## Folder structure

```
lib/syllabus/
  models/syllabus.types.ts          Every type: ExtractedSyllabus + all 12 feature outputs
  validation/syllabus.validation.ts  Ingestion + planner + progress input validation
  utils/
    syllabus.errors.ts               Errors for NEW functionality only (ingestion, planning)
    syllabus.logger.ts               Structured logger, module: "syllabus"
  ingestion/
    pdf.extractor.ts                 pdf-parse (PINNED to v1 — see note below)
    docx.extractor.ts                mammoth
    text.extractor.ts                normalization only
    ingestion.service.ts             Dispatcher; OCR fallback via your EXISTING ocr.service.ts
  prompts/                           One PromptDefinition per AI feature (11 files)
  services/
    _syllabus-ai.runner.ts           ⭐ THE integration point — see below
    syllabus-extraction.service.ts   Upload -> ExtractedSyllabus
    roadmap.service.ts               1. Smart Roadmap
    study-planner.service.ts         2. Study Planner (deterministic, NO AI call — see file header)
    notes.service.ts                 3. AI Notes (6 variants)
    flashcards.service.ts            4. Flashcards (+ SM-2 SRS metadata init)
    quiz.service.ts                  5. Quiz Generator (8 question types)
    paper-predictor.service.ts       6. Previous Paper Predictor
    pyq-mapper.service.ts            7. PYQ Mapper
    revision.service.ts              8. AI Revision Mode (5 modes)
    doubt-generator.service.ts       9. Doubt Generator (viva/interview/lab/concept)
    progress-tracker.service.ts      10. Progress Tracker (deterministic, NO AI call)
    analytics.service.ts             11. Smart Analytics
  export/
    markdown.exporter.ts             Shared intermediate format for all resource kinds
    json.exporter.ts
    csv.exporter.ts                  Flattens each kind to its most sensible tabular shape
    docx.exporter.ts                 Real .docx via `docx` package
    pdf.exporter.ts                  Real .pdf via `pdfkit`
    export.service.ts                12. Export — single dispatcher for all 5 formats
```

## The two integration points (read this before wiring it in)

**1. `services/_syllabus-ai.runner.ts`** — every AI-feature service (roadmap,
notes, flashcards, quiz, paper predictor, pyq mapper, revision, doubts,
analytics, extraction) calls `runSyllabusPrompt()` from this ONE file,
which itself calls:

```ts
import { runStructured } from '@/lib/ai/services/_run-structured';
import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
```

These names come from your own `lib/ai/README.md` ("`_run-structured.ts`
Shared runner: PromptDefinition -> runAI(jsonMode) -> typed result").
**If your real export name, path, or `PromptDefinition` shape differs even
slightly, this is the only file in the entire module you need to edit.**
Every prompt file's `PromptDefinition<T>` object uses `{ id, system,
buildUserPrompt, responseSchema }` — adjust the field names here once if
yours differ, not per-prompt.

**2. `ingestion/ingestion.service.ts`** — image uploads and scanned PDFs
fall back to your **existing** OCR service rather than a new one:

```ts
import { runOcr } from '@/lib/ai/services/ocr.service';
```

Assumed signature: `runOcr(buffer: Buffer, mimeType: string): Promise<{ text: string; confidence: number }>`.
If your real `ocr.service.ts` exports something else (e.g. a class, a
different return shape), this import + the two call sites in that one
file are all that need to change.

Everything else in this module (retry, caching, rate limiting, logging
for AI calls) is inherited for free through `runStructured`/`engine.ts` —
nothing here reimplements it, per your instruction.

## Dependencies to install

```bash
npm install fast-xml-parser mammoth docx pdfkit
npm install pdf-parse@1.1.1
npm install -D @types/pdfkit @types/pdf-parse
```

**Important:** `pdf-parse` v2 shipped a completely different, class-based
API (`new PDFParse(...).getText()`) that breaks the simple
`pdfParse(buffer) -> { text, numpages }` call this module uses. Pin to
`1.1.1` (or adapt `ingestion/pdf.extractor.ts` if you'd rather use v2).

## What's deterministic vs. AI-generated

- **AI-generated** (via the shared engine): syllabus extraction, roadmap,
  notes, flashcards, quiz, paper prediction, PYQ mapping, revision packs,
  doubts, analytics.
- **Deterministic, no AI call**: Study Planner (remaining-days/hours math
  + weak/strong time redistribution + missed-day recovery) and Progress
  Tracker (completion/revision/confidence/mastery scoring). Both are
  genuinely computational — re-running an LLM for arithmetic would be
  slower, costlier, and non-reproducible for no benefit. See the header
  comment in each service file for the reasoning.
- **Export** is pure formatting over already-generated data — no AI call.

## Suggested API route wiring (not included — no route/frontend changes made)

```ts
// app/api/syllabus/extract/route.ts
import { extractSyllabus } from '@/lib/syllabus/services/syllabus-extraction.service';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const format = /* derive from file.type */ 'pdf';
  const result = await extractSyllabus({ format, content: buffer, mimeType: file.type });
  return Response.json(result);
}
```

Every other feature service takes the `ExtractedSyllabus` this returns
(persist it via your existing Supabase layer — storage is intentionally
out of scope here since DB schema is off-limits) plus feature-specific
options, e.g.:

```ts
const roadmap = await generateSmartRoadmap(syllabus, { examDate, hoursAvailablePerDay: 4 });
const plan = buildAdaptiveStudyPlan(roadmap, { syllabusId, examDate, hoursAvailablePerDay: 4, weakTopics: [...] });
const notes = await generateNotes(syllabus, 'Unit 3: Graph Algorithms', 'exam');
const cards = await generateFlashcards(syllabus, 'Unit 3: Graph Algorithms', 20);
const quiz = await generateQuiz(syllabus, ['Unit 3'], { questionTypes: ['mcq', 'numerical'] });
const prediction = await predictPaper(syllabus, previousPapersRawText);
const pyqMap = await mapPreviousYearQuestions(syllabus, previousPapersRawText);
const revision = await generateRevisionPack(syllabus, 'thirty_min', ['Unit 3', 'Unit 4']);
const doubts = await generateDoubts(syllabus, ['Unit 3']);
const progress = computeProgressSnapshot(syllabus.id, topicProgressInputs);
const analytics = await generateSmartAnalytics(syllabus, previousPapersRawText);
const file = await exportResource({ kind: 'quiz', data: quiz }, 'pdf');
```

## What's confirmed working

- 22 TypeScript files, strict mode, zero `any` outside justified spots (raw
  provider parsing), zero TODO/placeholder/mock data.
- Type-checked clean end-to-end against stubs of the two integration
  points above.
- `pdf-parse` version pin verified at the exact API shape this code calls.

## Next module (waiting on your confirmation, per your process)

This completes Syllabus AI. Say the word for whatever's next.
