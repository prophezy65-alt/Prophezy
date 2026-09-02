# `lib/project-generator/services/`

Business logic for the Project Generator: turns a `GenerationRequest`
(from `models/`) into every downstream artifact — `ProjectSpec`,
`DatabaseSchema`, `ApiDesign`, `Roadmap`, `DiagramSet`, `DeploymentPlan`,
`TestingPlan`, `SecurityPlan`, `ProjectEstimation`, and finally an
`ExportBundle` — by calling the AI Core and/or deterministic computation,
then validating everything against the model-level `validateX()` guards
before returning it.

19 files, ~3,770 lines. Compiles clean under `tsc --strict
--noUnusedLocals --noUnusedParameters --noImplicitReturns
--noFallthroughCasesInSwitch`.

## Architecture

```
GenerationRequest
      │
      ▼
source-parser.service.ts ──────► plain text
      │
      ▼
project-spec.service.ts ───────► ProjectSpec  ──┐
      │                                          │
      ▼                                          │
database-schema.service.ts ────► DatabaseSchema ─┤
      │                                          │
      ▼                                          │
api-design.service.ts ─────────► ApiDesign ──────┤
      │                                          │
      ▼                                          │
roadmap.service.ts ────────────► Roadmap ────────┤
      │                                          │
      ├──► diagram.service.ts ───► DiagramSet ───┤
      ├──► deployment.service.ts ► DeploymentPlan ┤
      ├──► testing.service.ts ───► TestingPlan ───┤
      ├──► security.service.ts ──► SecurityPlan ──┤
      └──► estimation.service.ts ► ProjectEstimation (deterministic, no AI call)
                                                   │
                                                   ▼
                                    export.service.ts ──► ExportBundle (ZIP)
```

`generation-orchestrator.service.ts` runs this whole chain for one
`GenerationRequest`, emitting a `GenerationProgressEvent` before each step
and returning a fully-populated `GenerationResult` — including every
artifact produced up to the point of failure, if any step fails.

## Files

| File | Purpose |
|---|---|
| `types.ts` | DI contracts every service depends on: `AICoreClient`, `CacheProvider`, `Logger`, `Clock`, `IdGenerator`, `ServiceContext` |
| `defaults.ts` | Working default implementations: `ConsoleLogger`, `InMemoryCacheProvider`, `SystemClock`, `UuidGenerator`, `LocalFilesystemBundleUploader` |
| `ai-core-client.ts` | **The only file that imports `lib/ai/engine.ts`.** Wraps `runAI()` with caching, JSON-mode parsing, and a one-shot corrective retry on schema mismatch |
| `json-utils.ts` | Defensive JSON parsing/repair (code-fence stripping, preamble slicing, trailing-comma removal) |
| `parsing.ts` | Shared runtime type assertions (`assertString`, `assertNumber`, `assertArray`, `coerceEnum`, etc.) used by every AI-backed service's response parser |
| `errors.ts` | Maps AI Core exceptions / internal failures to the shared `GenerationError` shape |
| `source-parser.service.ts` | Normalizes any `GenerationSource` (idea/prompt/PDF/research paper/image/voice/flowchart) into plain text |
| `project-spec.service.ts` | Generates the central `ProjectSpec` — title, objectives, modules, features, folder structure, tech stack, difficulty/complexity, cost |
| `database-schema.service.ts` | Generates tables, columns, indexes, FKs, RLS policies, storage buckets |
| `api-design.service.ts` | Generates REST resources/endpoints with request/response schemas and error responses |
| `roadmap.service.ts` | Generates phases, tasks (with dependency-cycle repair), milestones, timeline |
| `diagram.service.ts` | Generates Mermaid-backed flowchart/ER/class/sequence/use-case/architecture/database/folder diagrams |
| `deployment.service.ts` | Generates per-target deployment guides + a GitHub Actions CI/CD pipeline |
| `testing.service.ts` | Generates unit/integration/API/edge-case/e2e test suites |
| `security.service.ts` | Generates rate limits, validation rules, auth flow, RBAC roles, sanitization rules |
| `estimation.service.ts` | **Deterministic** — computes cost/effort/complexity/timeline from the spec + roadmap with auditable formulas, no AI call |
| `export.service.ts` | Renders README + GitHub templates, writes every artifact as a real file, builds a SHA-256 manifest, and zips everything via `archiver` |
| `generation-orchestrator.service.ts` | Runs the full pipeline end-to-end and returns a `GenerationResult` |
| `index.ts` | Barrel export |

## The AI Core contract

`ai-core-client.ts` is the **only** file in this module that imports
`lib/ai/engine.ts`. Every other service calls `AICoreClient.runStructured()`
or `AICoreClient.extractTextFromMedia()` instead — see `types.ts`. This
mirrors the codebase's existing `services/_run-structured.ts` pattern
(`PromptDefinition -> runAI(jsonMode) -> typed result`).

`ai-core-client.ts` expects `lib/ai/engine.ts` to export:

```typescript
export function runAI(options: {
  featureKey: string;
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  userId?: string;
}): Promise<{
  text: string;
  modelUsed: string;
  usage: { inputTokens: number; outputTokens: number };
}>;
```

**If your actual `runAI` signature differs, `ai-core-client.ts` is the
only file you need to adjust** — no other service needs to change. It is
imported via the `@/lib/ai/engine` path alias; add `"paths": { "@/*":
["./*"] }` to your `tsconfig.json` if you don't already have it (the rest
of your codebase, per the screenshots, already uses this convention).

It also recognizes the AI Core's documented error classes by `.name`
(`AITimeoutError`, `AISafetyBlockedError`, `AIValidationError`,
`AIRequestError`) without a hard import dependency on
`lib/ai/utils/errors.ts`'s exact export path — so it degrades gracefully
even if that file's exports move.

## Dependency injection

Every service takes a `ServiceContext` (`{ aiCore, cache, logger, clock,
ids }`) instead of reaching for globals. Wire it up once at the API-route
level:

```typescript
import { EngineAICoreClient, createDefaultServiceContext, LocalFilesystemBundleUploader } from "lib/project-generator/services";

const defaults = createDefaultServiceContext("project-generator");
const context = {
  ...defaults,
  aiCore: new EngineAICoreClient(defaults.cache, defaults.logger),
};
const uploader = new LocalFilesystemBundleUploader("/tmp/project-generator-exports");
```

In production, replace `defaults.cache` and `defaults.logger` with
adapters over `lib/ai/middleware/cache.ts` (Upstash Redis) and
`lib/ai/utils/logger.ts` (structured JSON logging), and replace
`LocalFilesystemBundleUploader` with a Supabase Storage-backed
`BundleUploader` — every consumer keeps working unchanged because they
depend on the interfaces in `types.ts` / `export.service.ts`, not the
concrete classes.

## Error handling

Every service returns `Result<T, GenerationError>` — never throws across
its own boundary (see `models/shared.model.ts`). `errors.ts` centralizes
mapping AI Core exceptions and validation failures onto the shared
`GenerationErrorCode` union (`AI_CORE_ERROR`, `AI_TIMEOUT`,
`AI_SAFETY_BLOCKED`, `VALIDATION_FAILED`, `SCHEMA_MISMATCH`,
`INVALID_SOURCE`, `INTERNAL_ERROR`, etc.), each flagged `retryable` or not
so callers (e.g. an API route) know whether to offer a retry button.

## Retry logic

- **Transport-level retries** (timeouts, 5xx, rate limits) are the AI
  Core's job (`lib/ai/utils/retry.ts`, per the existing README) —
  `ai-core-client.ts` does not duplicate that.
- **Schema-level retries** are this module's job: if the AI Core returns
  JSON that fails the caller's `parse()` validator, `runStructured()`
  automatically retries **once** with a corrective follow-up prompt that
  includes the validation error and the previous (truncated) response,
  before giving up.
- **Roadmap dependency cycles**: if the AI introduces a circular task
  dependency, `roadmap.service.ts` repairs it by dropping the most recent
  offending edge (bounded to 50 iterations) rather than failing the whole
  generation over a fixable inconsistency.

## Caching

`CacheProvider` (`types.ts`) is a two-method interface (`get`/`set`, plus
`delete`) that `ai-core-client.ts` uses to cache structured AI responses
by a SHA-256 hash of `(featureKey + systemPrompt + userPrompt)`, with a
per-call TTL (`StructuredAIRequest.cacheTtlSeconds`). `defaults.ts` ships
a working `InMemoryCacheProvider` (real TTL eviction, not a stub) for
local dev; swap in an adapter over the existing Upstash-backed
`lib/ai/middleware/cache.ts` for production so cache hits are shared
across serverless invocations.

## Logging

`Logger` (`types.ts`) is a 4-level structured interface. `defaults.ts`
ships `ConsoleLogger`, which emits one structured JSON line per call
(safe for serverless/edge log aggregation). Every service logs at the
start and end of its work, and on every failure, with enough context
(`projectSpecId`, counts, error messages) to debug a failed generation
without re-running it.

## Verified

```bash
npm install --save-dev typescript archiver @types/archiver @types/node
npx tsc --noEmit --strict --noUnusedLocals --noUnusedParameters \
  --noImplicitReturns --noFallthroughCasesInSwitch
```
passes with zero errors against this module + `models/`.

## What's next

`prompts/` can now be extracted from the inline `buildSystemPrompt()` /
`buildUserPrompt()` pairs in each `*.service.ts` file into standalone
`PromptDefinition` objects matching the existing
`lib/ai/prompts/_shared.ts` convention, if you want prompt text
versioned and reused independently of the service that calls it.
`validation/` can add richer business-rule checks beyond the structural
guards already enforced by each model's `validateX()` function (e.g.
cross-checking estimated cost against actual regional pricing APIs).
`export/` can grow beyond ZIP into PDF/DOCX/HTML rendering of the same
`ExportBundle` content.
