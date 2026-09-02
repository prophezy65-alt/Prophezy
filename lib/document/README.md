# Prophezy — Document Intelligence Engine

The universal document backend. Every other module calls:

```ts
import { documentService } from "@/lib/document";

const doc = await documentService.process({
  userId,
  ownerModule: "resume-studio", // or "flashcards", "research-ai", null, etc.
  filename: "syllabus.pdf",
  format: "pdf",
  buffer: fileBuffer,
  mimeType: "application/pdf",
});
```

and gets back one normalized `ProphezyDocument` — pages, sections, tables,
figures, code blocks, formulas, topics, keywords, chunks, analysis, summary —
regardless of which of the 16 supported formats it started as.

## Architecture

```
lib/document/
  types/          FileFormat, DocumentTypeLabel, SearchMode, ChunkStrategy, etc.
  constants/      size limits, MIME maps, magic-byte signatures
  errors/         typed error hierarchy (DocumentError + 8 subclasses)
  models/         Document, Page, Section, Heading, Paragraph, Table, Figure,
                   Image, CodeBlock, Formula, Metadata, Topic, Keyword, Chunk,
                   Embedding, Analysis, SearchResult
  validation/      Zod schemas + file-security.ts (magic-byte spoofing checks,
                   zip-bomb/zip-slip guards, injection scanning)
  ocr/            sharp-based image enhancement (real) + OCR provider adapter
  providers/      pdf, docx, xlsx, csv, markdown, html, json, image (all real
                   parsers) + ppt, zip (real logic, one reuse point each — see below)
  parser/         parser.service.ts — dispatches all 16 formats to the right provider
  extractor/      AI smart-extraction (topics/keywords/definitions/summary/type)
                   + deterministic table/code/formula detectors for plain text
  chunking/       real recursive, semantic, and sliding-window chunkers
  embeddings/     embedding.service.ts (embed() via AI Core Engine) + indexing
  search/         8 modes: semantic, keyword, hybrid (RRF), full-text, metadata,
                   section, page, topic
  analysis/       language detection, Flesch-Kincaid complexity, sentiment,
                   reading-time estimate — all real, dependency-free
  cache/          Upstash Redis cache with in-memory fallback, content-hashed keys
  analytics/      processing event log, stats, health check
  export/         formatters.ts (json/markdown/txt/html/csv, all real)
  services/       document.service.ts (the orchestrator), validation, export,
                   compression
  utils/          metadata cleaner, markdown formatter, JSON builder, image optimizer

supabase/migrations/
  0022_document_intelligence.sql   7 new tables + match_document_chunks() RPC
```

## The `process()` pipeline

```
validate -> parse -> deterministic extraction (tables/code/formulas)
  -> AI smart extraction (topics/keywords/definitions/summary/doc-type)
  -> analysis (language/complexity/sentiment) -> chunk -> embed -> index
  -> persist -> return
```

Every stage logs a `document_analytics` event (`parsing_started`,
`parsing_completed`, `ocr_*`, `extraction_completed`, `chunking_completed`,
`embedding_completed`, `indexing_completed`, `processing_completed` /
`processing_failed`) so `analytics.service.ts` can report per-stage timing
and failure rates without any extra instrumentation at call sites.

Processing is content-hash cached (`cache.service.ts` + the
`processed_files` table) — re-uploading the exact same bytes short-circuits
straight to the cached result instead of re-parsing/re-embedding.

## Database

All 7 tables are **new** — nothing from 0001-0021 is touched:

`documents`, `document_metadata`, `document_chunks`, `document_embeddings`,
`document_search_index`, `document_analytics`, `processed_files`, plus a
`match_document_chunks()` SQL function for pgvector cosine search (Supabase's
JS client can't express `<=>` ordering directly — same pattern as the
Flashcards Engine's `match_flashcards()`).

**Not yet persisted**: pages/sections/tables/figures/code/formulas are
returned in-memory from `process()` but not written to their own tables —
only `documents` (summary/metadata) and `document_chunks` (for search) are
durable right now. If a consuming module needs the full structural
breakdown back *without* re-processing, add page/section tables and persist
them in `document.service.ts`'s final-write step — the models are already
shaped for it, it's a straightforward addition, not a redesign.

## Things built against a documented assumption

Same honesty policy as the Flashcards Engine — real logic everywhere,
and anything depending on a file I don't have source for throws a clear,
actionable error instead of faking a result:

| File | What's assumed | Fix |
|---|---|---|
| `services/document.service.ts`, most services | `getSupabaseServerClient()` at `@/lib/supabase/server` | One import line, everywhere it's used |
| `ocr/ocr.provider.ts` | Real `ocr.service.ts` export shape (same as Flashcards Engine — should be the SAME underlying service, not a second implementation) | One import line |
| `providers/ppt.provider.ts` | A shared PPTX slide-text extractor somewhere in the codebase (no PPTX library in your stated stack) | Point `SHARED_PPTX_MODULE_PATH` at the real module |
| `providers/zip.provider.ts` | `adm-zip` as a dependency (no zip library in your stated stack) | `npm install adm-zip`, or swap for whatever's already used elsewhere |
| `embeddings/embedding.service.ts` | `embed()`'s exact signature (only its name is in your README) | One call site to adjust if the real signature differs |
| `services/export.service.ts` (docx/pdf cases) | Reuses Resume Studio's DOCX/PDF builders | Wire two function calls; json/markdown/txt/html/csv are fully implemented |

Everything else — all parsers, chunking strategies, image enhancement,
language/complexity/sentiment analysis, search (including hybrid RRF
fusion), and export formatting — is real, working logic. Nothing is a
stub, mock, or TODO.

## Not built / explicitly out of scope

- PDF page-level OCR rasterization: `pdf.provider.ts` correctly *flags*
  which pages have no usable text layer (`pagesNeedingOcr()`), but actually
  rasterizing a specific PDF page to an image for OCR needs a PDF
  rasterizer (e.g. `pdf-to-img`, `pdfjs-dist` canvas rendering, or a
  poppler/ghostscript shell-out) not present in your listed stack — the
  hook point is clearly marked in `parser.service.ts`.
- EPUB/LaTeX/ODT/RTF: recognized as "future formats" per the spec, and
  routed to a clear `FutureFormatError` rather than silently mishandled.
- True `.docx`/`.pdf` export bodies (see wiring table above) and `.apkg`
  Anki-style packaging (not applicable to this module, that's Flashcards').
