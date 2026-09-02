# Hackathon Intelligence Engine — `lib/hackathons`

Standalone, DB-agnostic backend module for Prophezy's AI Hackathon Engine.
Discovers hackathons across 15 sources, analyzes them, generates project
ideas and prep plans, and tracks participation — not a listing page.

Does **not** modify auth, frontend, database schema, AI Core, or any other
existing AI module — it reuses them through narrow provider interfaces.

## Folder structure

```
lib/hackathons/
├── models/hackathon.model.ts          # Every domain type
├── validation/hackathon.validation.ts # Zod schemas — every input AND every AI-output boundary
├── providers/
│   ├── ai-core.provider.ts            # AI Core Engine interface — NEVER calls Gemini directly
│   ├── module-providers.ts            # Interfaces to Resume Studio, Career Guidance, Project Generator, etc.
│   ├── cache.provider.ts              # Redis-backed cache interface
│   ├── job-queue.provider.ts          # Background job interface (sync jobs, reminder scans)
│   └── sources/                       # One adapter per hackathon source
│       ├── source-adapter.interface.ts
│       ├── source-registry.ts         # Central registry — add a source here, nowhere else
│       ├── normalize.ts               # Shared hashing/ID/mode-inference helpers
│       ├── devpost.adapter.ts         # ✅ implemented — real Devpost public API
│       ├── github-events.adapter.ts   # ✅ implemented — real GitHub Search API (hackathon-topic repos)
│       └── unimplemented-sources.ts   # MLH, Unstop, Devfolio, Hack2Skill, DoraHacks, ETHGlobal,
│                                       # AngelHack, Google/Microsoft/AWS Events, HackClub, YC Events —
│                                       # registered + typed, throw a clear error until implemented
├── utils/
│   ├── theme-analyzer.ts / prize-analyzer.ts / technology-analyzer.ts
│   ├── timeline-calculator.ts         # Urgency, deadline math, prediction fallback
│   ├── difficulty-calculator.ts       # Deterministic difficulty fallback
│   ├── ranking-engine.ts              # Personalized ranking + match scoring
│   ├── checklist-generator.ts         # Baseline submission/presentation/demo/judging checklist
│   ├── markdown-formatter.ts / json-formatter.ts / export-builder.ts
│   ├── security.ts                    # Prompt-injection mitigation
│   ├── retry.ts / logger.ts / pagination.ts
├── analytics/tracking-analytics.ts    # Tracking dashboard aggregation
├── prompts/hackathon-prompts.ts       # Every AI Core prompt template, centralized + sanitized
├── planner/
│   ├── milestone-templates.ts         # Static fallback prep timeline (works if AI Core is down)
│   └── timeline-builder.ts            # Milestone normalization
├── recommendation/recommendation-postprocess.ts  # Dedupe/rank AI recommendations
├── tracking/
│   ├── tracking.repository.ts         # DB-agnostic interface for saved/registered/completed
│   └── notification.repository.ts     # DB-agnostic interface for notifications
├── search/
│   ├── keyword-search.ts              # Deterministic fallback search
│   └── vector-search.provider.ts      # pgvector interface (implemented by DB layer)
├── export/
│   ├── hackathon-pdf.export.ts        # Binary PDF report (pdf-lib)
│   └── hackathon-docx.export.ts       # Binary DOCX report (docx)
├── services/                          # All 14 services from the spec
└── supabase/migrations/0001_hackathon_engine_tables.sql  # OPTIONAL, additive-only
```

## Install

```bash
npm install zod pdf-lib docx
```

## Source adapters — what's real vs. what's a stub

Two adapters make real HTTP calls today:

- **Devpost** — uses `https://devpost.com/api/hackathons`, Devpost's own
  unauthenticated JSON listing endpoint.
- **GitHub Events** — uses GitHub's documented Search API to surface
  repositories tagged with the `hackathon` topic. This is a discovery aid
  (GitHub doesn't publish structured event data), not an authoritative
  listing like Devpost's.

The other 13 sources (MLH, Unstop, Devfolio, Hack2Skill, DoraHacks,
ETHGlobal, AngelHack, Google/Microsoft/AWS Developer Events, HackClub, Y
Combinator Events) mostly don't expose a stable public API — several
require partner API keys or scraping that would need per-site maintenance.
Rather than ship guessed endpoints that would silently return wrong data,
each is registered as a fully-typed `HackathonSourceAdapter` that throws
`SourceNotImplementedError` until implemented. **Nothing else changes**
when you implement one — see "Adding a new source" below.

### Adding a new source

1. Create `providers/sources/{name}.adapter.ts` implementing `HackathonSourceAdapter`.
2. Map that source's native response into the shared `Hackathon` model using the helpers in `normalize.ts`.
3. Validate the mapped result against `hackathonSchema` before returning it (see `devpost.adapter.ts` for the pattern).
4. Swap it into `source-registry.ts`'s `createDefaultSourceRegistry()` in place of the `UnimplementedSourceAdapter` entry.

Nothing in `provider.service.ts`, ranking, search, or recommendations needs
to change — they all depend on `HackathonSourceAdapter`, not concrete classes.

## Wiring into the app

Every service is constructor-injected:

```ts
import { HackathonService, createInMemoryHackathonRepository } from "@/lib/hackathons/services/hackathon.service";
import { ProviderService } from "@/lib/hackathons/services/provider.service";
import { createDefaultSourceRegistry } from "@/lib/hackathons/providers/sources/source-registry";

const hackathonRepo = realSupabaseHackathonRepository; // implement HackathonRepository
const hackathonService = new HackathonService(hackathonRepo);
const providerService = new ProviderService(createDefaultSourceRegistry(), hackathonService);

const aiCore: AiCoreClient = realAiCoreClient; // the existing AI Core Engine's client
const analysisService = new AnalysisService(aiCore);
const ideaService = new IdeaService(aiCore, realProjectGeneratorAdapter);
// ...
```

Run `providerService.syncAllSources()` on a schedule (GitHub Actions cron,
Supabase cron, or your job queue) — never on the request path.

## Design principles followed

- **Never calls Gemini directly** — every AI call goes through `AiCoreClient`.
- **Never duplicates other modules** — Project Generator, Career Guidance, Resume Studio, etc. are pulled through provider interfaces.
- **Degrades gracefully** — difficulty estimation, preparation timelines, and checklists all have deterministic fallbacks if AI Core fails or returns invalid JSON.
- **Every AI JSON response is schema-validated** before use.
- **Prompt injection mitigation** — all free text (hackathon descriptions, rules) goes through `sanitizeForPrompt` / `fenceUntrustedContent`.
- **DB-agnostic** — `HackathonRepository`, `TrackingRepository`, `NotificationRepository`, `VectorSearchRepository` are all interfaces; the optional migration adds new tables only.
- **Open/Closed source design** — adding a hackathon source never requires touching ranking, search, or recommendation logic.
- **Cursor pagination** throughout list/search endpoints for scalability.
