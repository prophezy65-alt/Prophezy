# Career Guidance Intelligence Engine — `lib/career`

Standalone, DB-agnostic backend module for Prophezy's AI Career Guidance
Engine. Analyzes a student's full profile (resume, projects, skills, quiz
and interview performance, syllabus progress, goals) to generate
personalized career guidance.

Does **not** modify auth, frontend, database schema, AI Core, Resume
Studio, or any of the other existing AI modules — it reuses them through
narrow provider interfaces.

## Folder structure

```
lib/career/
├── models/career.model.ts            # Every domain type (Profile, Role, Roadmap, Analytics, ...)
├── validation/career.validation.ts   # Zod schemas for every input AND AI-output boundary
├── providers/
│   ├── ai-core.provider.ts           # Interface to the AI Core Engine — NEVER calls Gemini directly
│   ├── module-providers.ts           # Interfaces to Resume Studio, Interview AI, Quiz AI, etc.
│   └── cache.provider.ts             # Redis-backed cache interface (in-memory stub included)
├── utils/
│   ├── skill-analyzer.ts             # Deterministic skill scoring/matching
│   ├── career-matcher.ts             # Deterministic role/industry/company match %
│   ├── progress-calculator.ts        # Learning progress, readiness, composite career score
│   ├── salary-estimator.ts           # Deterministic salary baseline table
│   ├── recommendation-engine.ts      # Dedupe/rank/clamp AI-generated recommendations
│   ├── roadmap-generator.ts          # Milestone normalization, semester splitting
│   ├── resume-analyzer.ts            # Deterministic resume/goal-alignment pre-signal
│   ├── markdown-formatter.ts / json-formatter.ts / export-builder.ts
│   ├── security.ts                   # Prompt-injection mitigation & input sanitization
│   ├── retry.ts                      # Exponential backoff for AI Core calls
│   └── logger.ts                     # Structured JSON logging
├── analytics/benchmark.ts            # Score → tier benchmarking
├── prompts/career-prompts.ts         # Every AI Core prompt template, centralized
├── roadmaps/roadmap-templates.ts     # Static fallback roadmaps (works if AI Core is down)
├── recommendations/catalog.ts        # Static Role/Industry/Company catalog
├── search/
│   ├── keyword-search.ts             # Deterministic fallback search
│   └── vector-search.provider.ts     # pgvector interface (implemented by DB layer)
├── export/
│   ├── career-pdf.export.ts          # Binary PDF report (pdf-lib)
│   └── career-docx.export.ts         # Binary DOCX report (docx)
├── services/
│   ├── career.service.ts             # Profile aggregation + AI Career Advisor Q&A
│   ├── skills.service.ts             # Skill Gap Analysis
│   ├── roadmap.service.ts            # Learning Roadmaps + Semester Planning + Interview Prep Plan
│   ├── recommendation.service.ts     # Career path/cert/course/switch/startup/freelance/remote + Higher Studies
│   ├── analytics.service.ts          # Full CareerAnalytics dashboard object
│   ├── company.service.ts            # Company Recommendation + match %
│   ├── industry.service.ts           # Industry Recommendation, trends, emerging skills
│   ├── salary.service.ts             # Salary Estimation
│   ├── resume-analysis.service.ts    # Resume Improvement Suggestions (career-context)
│   ├── learning.service.ts           # Course/Certification/Project recommendations + learning plan
│   ├── search.service.ts             # Semantic + keyword search
│   └── export.service.ts             # PDF/DOCX/Markdown/HTML/JSON report export
└── supabase/migrations/0001_career_guidance_tables.sql  # OPTIONAL, additive-only new tables
```

## Install

```bash
npm install zod pdf-lib docx
```

(No new AI SDK needed — all AI calls go through the existing AI Core
Engine's client, injected via `AiCoreClient`.)

## Wiring into the app

Every service is built via constructor dependency injection — nothing
reaches into a global singleton — so wire real implementations once at
app bootstrap (e.g. `lib/career/bootstrap.ts`, not included here since it
depends on how your other modules expose their clients):

```ts
import { CareerService } from "@/lib/career/services/career.service";
import { SkillsService } from "@/lib/career/services/skills.service";
// ...

const providers: CareerModuleProviders = {
  resumeStudio: realResumeStudioAdapter,   // implement against Resume Studio
  interviewAi: realInterviewAiAdapter,      // implement against Interview AI
  quizAi: realQuizAiAdapter,
  flashcardsAi: realFlashcardsAdapter,
  notesAi: realNotesAdapter,
  assignmentAi: realAssignmentAdapter,
  researchAi: realResearchAdapter,
  projectGenerator: realProjectGeneratorAdapter,
  syllabusAi: realSyllabusAdapter,
};

const aiCore: AiCoreClient = realAiCoreClient; // the existing AI Core Engine's client

const careerService = new CareerService(providers, redisCacheProvider, aiCore);
const skillsService = new SkillsService(aiCore);
const roadmapService = new RoadmapService(aiCore, redisCacheProvider);
const recommendationService = new RecommendationService(aiCore);
// etc.
```

Each adapter (`realResumeStudioAdapter`, etc.) is a small class in your
app implementing the corresponding interface from `providers/module-providers.ts`,
translating that module's real data into the minimal summary shape career
guidance needs. This keeps the Career Engine fully decoupled and testable.

## Design principles followed

- **Never calls Gemini directly.** Every AI call goes through `AiCoreClient` (`providers/ai-core.provider.ts`).
- **Never duplicates other modules.** Resume parsing, interview scoring, quiz analytics, etc. are pulled through provider interfaces, not reimplemented.
- **Degrades gracefully.** Skill gap, roadmap, and resume analysis all have deterministic fallbacks (static catalog / templates) if AI Core fails or returns invalid JSON — validated via Zod before being trusted.
- **Prompt injection mitigation.** All free text embedded into prompts goes through `sanitizeForPrompt` / `fenceUntrustedContent` in `utils/security.ts`.
- **Every AI JSON response is schema-validated** (`validation/career.validation.ts`) before use — "output validation" per the security requirements.
- **DB-agnostic.** No Supabase client imported anywhere in `services/` or `utils/`; the optional migration only adds new tables and is not required for the module to compile or run in-memory.
- **Caching + retry hooks** are interfaces (`CacheProvider`, `withRetry`) so Redis and network-retry behavior are swappable without touching business logic.
