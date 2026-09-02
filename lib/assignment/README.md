# Prophezy Assignment Intelligence Engine

Backend module for `lib/assignment/`. Every AI call in this module routes through
the existing AI Core Engine (`lib/ai/engine.ts` — `runAI()` / `runAIStream()`) via a
single adapter file, `providers/ai-engine.provider.ts`. **No file in this module ever
calls Gemini directly.** Nothing here modifies auth, frontend, DB schema, or any other
existing feature — this module only adds new files under `lib/assignment/`.

## Status: Parts 1 + 2 complete

Everything in the original spec is now implemented: upload → OCR → question detection →
solution generation → flashcards/quiz/revision notes/practice questions → diagrams →
tone rewriting → quality checks → all six exporters → example API routes.

### Part 1 — foundation

```
lib/assignment/
  models/
    types.ts                  Every domain type used across the module
  providers/
    ai-engine.provider.ts     SOLE integration point with lib/ai/engine.ts
  prompts/
    _shared.ts                PromptDefinition contract + JSON-mode helpers
    ocr.ts                    OCR cleanup / structuring prompt
    question-detection.ts     Question classification prompt
    solution.ts                Full step-by-step solution prompt
    quality-check.ts          Grammar / tone / consistency prompt
  parser/
    file-router.ts            MIME/extension -> category resolution, size guards
    text-parsers.ts           PDF/DOCX/TXT/MD/code native-text extraction
    archive-parsers.ts        ZIP expansion (with zip-bomb guards) + PPTX text
  services/
    ocr.service.ts            Two-stage OCR: Tesseract -> Gemini vision fallback
    pdf-render.util.ts        Rasterizes scanned PDF pages for OCR input
    parser.service.ts         Routes any upload to the correct extraction path
    question.service.ts       Segments + classifies questions, merges keyword sources
    generator.service.ts      Generates full QuestionSolution per question
    citation.service.ts       APA/IEEE citation formatting + reliability heuristic
    validator.service.ts      Grammar, tone, citation, duplicate-content, consistency
    assignment.service.ts     TOP-LEVEL ORCHESTRATOR — call this from API routes
    analytics.service.ts      Event logging (no-op persist stub) + mastery stats
    _logger.ts                Structured JSON logger
  utils/
    question-parser.ts        Deterministic question-boundary segmentation
    difficulty-estimator.ts   Deterministic difficulty scoring / AI cross-check
    keyword-extractor.ts      TF-based keyword extraction, Jaccard similarity
    table-parser.ts           Markdown + whitespace-aligned table detection
    equation-parser.ts        LaTeX/unicode-math equation detection
    markdown-formatter.ts     Question/solution -> Markdown rendering
    json-parser.ts            Safe JSON parse/stringify for domain data
    export-utility.ts         CSV building, filename/mime helpers
```

### Entry point

```ts
import { processAssignmentBatch } from "@/lib/assignment/services/assignment.service";

const documents = await processAssignmentBatch(batch, {
  userId,
  fetchFileBuffer: (storagePath) => downloadFromSupabaseStorage(storagePath),
});
```

Then, on demand per question (not all up front — keeps AI spend proportional to what
the student actually asks for):

```ts
import { generateSolution } from "@/lib/assignment/services/generator.service";

const solution = await generateSolution(question, { userId, depthMode: "standard" });
```

### Peer dependencies required (not yet in `package.json`)

```
npm install tesseract.js pdf-parse mammoth jszip pdfjs-dist canvas
```

### Design decisions worth knowing about

- **Two-stage OCR** — Tesseract runs first (free, fast). Only low-confidence pages
  (<65% confidence or <10 chars extracted) escalate to the Gemini vision fallback
  through the Core Engine, keeping AI cost proportional to actual difficulty.
- **Deterministic pre-passes before AI passes** — question segmentation, keyword
  extraction, difficulty estimation, and table/equation detection all have a
  regex/heuristic layer that runs first. The AI classification pass is the source of
  truth, but the heuristics (a) cut token usage by pre-batching, and (b) provide a
  degrade-gracefully fallback if an AI call fails.
- **`ai-engine.provider.ts` is the only chokepoint** — if the real `lib/ai/engine.ts`
  export names differ from the assumed `runAI({...}) `/ `runAIStream({...})` signature
  (I could only partially see it in your screenshots), that's the one file to adjust.
- **Duplicate-content detection** is explicitly *within-upload* only (Jaccard
  similarity over extracted keywords) — it never claims external plagiarism detection,
  per the platform's stated scope.
- **No solution generation happens automatically for every question** — `generator.service.ts`
  is called per-question on demand, since generating a full step-by-step solution for
  every question in a 40-question paper the moment it's uploaded would be both slow and
  wasteful of AI budget if the student only needs help with three of them.

### Part 2 — content generation, export, security, API layer

```
lib/assignment/
  prompts/
    flashcards.ts              Flashcard generation prompt
    quiz.ts                    Quiz generation prompt (mcq/true_false/short_answer)
    revision-notes.ts          Structured revision notes prompt
    practice-questions.ts      Follow-up / viva / interview questions prompt
    diagram.ts                 Standalone Mermaid diagram prompt (topic-level, not
                                the diagrams embedded inside a solution)
    formatter.ts                Tone/register rewrite prompt (academic/professional/
                                simple/technical)
  services/
    flashcard.service.ts       Generates + de-duplicates flashcards across a document
    quiz.service.ts            Generates a quiz AND grades submitted answers
    summary.service.ts         Revision notes + follow-up/viva/interview questions
    diagram.service.ts         Standalone diagram generation + Mermaid syntax linter
    formatter.service.ts       Tone rewriting (+ named convenience wrappers matching
                                "Academic Tone Improver" / "Professional Tone" / etc.)
    export.service.ts          Orchestrates all six exporters behind one call
  export/
    exportable-content.ts      Shared bundle type every exporter consumes
    markdown.export.ts         .md exporter
    html.export.ts             Self-contained .html exporter (no external CSS)
    data.export.ts             .json and .csv exporters
    docx.export.ts             .docx exporter (via the `docx` package)
    pdf.export.ts               .pdf exporter (via `pdf-lib`, with manual text-wrap +
                                pagination since pdf-lib has no layout engine)
  validation/
    schemas.ts                 Dependency-free request validators for the API layer
    security.ts                Input sanitization, file-signature ("magic bytes")
                                verification, and prompt-injection scanning/wrapping
  examples/api-routes/
    assignment/upload/route.ts
    assignment/[documentId]/questions/[questionId]/solution/route.ts
    assignment/[documentId]/export/route.ts
    assignment/[documentId]/flashcards/route.ts
    assignment/[documentId]/quiz/route.ts   (POST generate, PUT grade)
    assignment/diagram/route.ts
    assignment/rewrite/route.ts
```

Copy the contents of `examples/api-routes/assignment/` into your real `app/api/assignment/`
and replace the two `declare function` stubs in each file (`getCurrentUserId`,
`downloadFromStorage`/`loadDocument...`) with your existing auth and data-access helpers
— those are intentionally left as typed stubs since this module doesn't touch auth or
the DB schema.

### Additional peer dependencies for Part 2

```
npm install docx pdf-lib
```

(Part 1's `tesseract.js pdf-parse mammoth jszip pdfjs-dist canvas` are still required.)

### Security notes

- **File signature verification** (`validation/security.ts`) checks actual file bytes
  against magic numbers rather than trusting the client-reported MIME type — wired into
  `assignment.service.ts` before any parsing happens.
- **Prompt-injection defense**: every prompt that interpolates raw extracted document
  text (`ocr.ts`, `question-detection.ts`, `solution.ts`) now runs it through
  `scanAndNeutralizeInjection()` and wraps it in explicit `<<<DOCUMENT_CONTENT_START>>>`
  delimiters, with the system prompt explicitly instructed to treat delimited content as
  data, never instructions. This covers the realistic threat here (a student — or
  someone messing with a student — hiding instruction-like text in a scanned page), not
  a claim of perfect adversarial robustness.
- **Filenames** are sanitized (path traversal / reserved characters stripped) before
  being used anywhere downstream (exports, storage references).

## Nothing left outstanding from the original spec

Every service, utility, prompt, and export format listed in the original brief now has
a real, working implementation. If you'd like, I can also generate the Supabase
migration for `assignment_analytics_events` (currently a logged no-op per the DO-NOT-MODIFY
schema constraint) once you're ready to wire persistence in — just say so.
