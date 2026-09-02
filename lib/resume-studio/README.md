# Resume Studio — Backend Module

Standalone backend module for Prophezy's Resume Studio. Built to the spec:
Next.js 15, TypeScript, Supabase/PostgreSQL, Gemini 2.5 (free tier), pdf-lib,
React PDF, Tesseract OCR. No OpenAI used anywhere.

This module does **not** touch auth, frontend/UI, or the database schema.
It is DB-agnostic via the `ResumeRepository` interface in
`services/resume.service.ts` — plug in your Supabase implementation there.

## Folder structure

```
resume-studio/
├── models/
│   └── resume.model.ts          # Core domain types (Resume, ATS, versions, AI)
├── validation/
│   └── resume.validation.ts     # Zod schemas for every input boundary
├── utils/
│   ├── resume-parser.ts         # Raw text -> structured content (regex/heuristics)
│   ├── resume-validator.ts      # Business-rule validation (dates, empty sections)
│   ├── resume-score.ts          # Deterministic 0-100 scoring, no AI required
│   ├── resume-export.ts         # JSON/Markdown/HTML string exporters
│   ├── resume-import.ts         # File-type detection + size limits
│   ├── resume-formatter.ts      # Whitespace/case/date/bullet normalization
│   ├── resume-keywords.ts       # Keyword extraction + JD matching
│   └── resume-template.ts       # Template registry (15 templates)
└── services/
    ├── ai/
    │   ├── gemini.client.ts     # Typed Gemini 2.5 API wrapper
    │   └── ai-prompts.ts        # Centralized prompt templates
    ├── resume.service.ts        # CRUD, versioning, diffing (DB-agnostic)
    ├── ats.service.ts           # Full ATS report (deterministic + AI)
    ├── parser.service.ts        # PDF/DOCX/TXT/MD import incl. OCR fallback
    ├── generator.service.ts     # Generic Gemini text-generation dispatcher
    ├── optimizer.service.ts     # JD-targeted resume optimization
    ├── humanizer.service.ts     # Removes AI-sounding phrasing
    ├── coverletter.service.ts   # Cover letter generation
    ├── linkedin.service.ts      # LinkedIn About generation
    ├── github.service.ts        # GitHub bio generation
    ├── portfolio.service.ts     # Portfolio bio generation
    ├── pdf-generator.service.ts # ATS-friendly PDF rendering (pdf-lib)
    └── docx-generator.service.ts# Word export rendering (docx)
```

## Install

```bash
npm install zod pdf-lib docx mammoth tesseract.js pdf-parse
```

Set `GEMINI_API_KEY` in your environment (used by `services/ai/gemini.client.ts`).

## Wiring into Next.js

1. Copy this `resume-studio/` folder into your project (e.g. under `lib/resume-studio` or `src/resume-studio`).
2. Implement `ResumeRepository` against Supabase (table names per your migrations, e.g. `0011_resumes.sql`) and pass it into `new ResumeService(repo)`.
3. Call services from your API routes (`app/api/resume-studio/**/route.ts`) — this module intentionally contains no route handlers, so routing/auth stays entirely in your existing app.

## Design principles followed

- Every AI call goes through one client (`gemini.client.ts`) — no OpenAI anywhere.
- AI-generated content never fabricates facts: prompts explicitly forbid inventing numbers/companies/dates.
- ATS scoring works even if Gemini is down (deterministic scoring is the fallback).
- All service boundaries return `ServiceResult<T>` (`{ ok, data, error }`) instead of throwing, so API routes can map errors to clean HTTP responses.
- Zod validates everything at the edges; `resume-validator.ts` adds business-rule checks zod can't express (date ordering, duplicate bullets).
