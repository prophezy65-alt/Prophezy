# `lib/opportunities/models/`

Type definitions and structural validators for the **Opportunity
Aggregation Engine** — the shared infrastructure layer that discovers,
imports, validates, normalizes, deduplicates, ranks (by recency/deadline
only — no AI recommendation logic lives here), caches, indexes, and
serves opportunities. This module has zero runtime dependencies beyond
`node:crypto` (for cache-key hashing) and touches no other Prophezy
module.

11 files, ~1,230 lines. Compiles clean under `tsc --strict
--noUnusedLocals --noUnusedParameters --noImplicitReturns
--noFallthroughCasesInSwitch`.

## Files

| File | Purpose |
|---|---|
| `enums.ts` | Every shared string-literal union: `OpportunityType` (with an `OTHER` extension point for future types), status, work mode, compensation type, experience level, provider kind/auth, sync trigger/status, health state, dedup decision, search sort/direction, cache namespace |
| `shared.model.ts` | `Result<T,E>`, `OpportunityEngineError`, pagination, `DateRange`, UUID/SHA-256/ISO-date guards |
| `opportunity.model.ts` | The canonical `Opportunity` entity + `NormalizedOpportunityDraft` (a provider's `normalize()` output before dedup assigns it a stable id) |
| `opportunity-source.model.ts` | `OpportunitySourceRecord` — every raw record ever fetched, independent of dedup outcome — plus `DedupOutcome`/`DedupComparison` |
| `provider.model.ts` | **The provider interface** (`OpportunityProvider`) every source implements: `fetch()` / `normalize()` / `validate()` / `sync()`, plus `ProviderConfig`, rate limit/retry policies |
| `sync.model.ts` | `SyncRun` (one row per sync attempt) + `ProviderScheduleState` (background sync due-date/backoff logic) |
| `health.model.ts` | `ProviderHealthSnapshot` + `deriveHealthState()`, the single source of truth for "what counts as degraded vs. down" |
| `tag.model.ts` | Normalized tag catalog (`Tag`) + synonym resolution (`resolveTag`) so "React"/"react"/"React.js" collapse to one canonical tag |
| `search.model.ts` | `SearchIndexRow` (the denormalized, precomputed search record) + `SearchQuery` / `SearchResult` / `SearchFacets` |
| `analytics.model.ts` | `ProviderStatistics`, `SyncHistoryPoint`, `EngineAnalyticsSnapshot` — aggregate stats only, no per-user logic |
| `cache.model.ts` | Deterministic `buildCacheKey()` (canonical JSON + SHA-256) and `CacheEntry<T>` envelope shared by every cached read path |
| `index.ts` | Barrel export |

## Design principles

- **No AI / recommendation logic.** This is explicitly infrastructure:
  discovery, normalization, dedup, indexing, and serving. Anything that
  ranks opportunities *for a specific user* belongs in a downstream
  module (e.g. Career Guidance AI, Internship Discovery AI), not here.
- **Providers are pure with respect to the engine.** `OpportunityProvider`
  (in `provider.model.ts`) is the sole extension point — implementing it
  is the only thing required to add a new opportunity source. The
  interface has no knowledge of caching, storage, or indexing.
- **Every raw record is kept**, not just the deduplicated result
  (`opportunity-source.model.ts`), so re-sync, dedup auditing, and "why
  was this merged into that opportunity" are all answerable without
  re-fetching from the provider.
- **Health thresholds are centralized.** `deriveHealthState()` in
  `health.model.ts` is the only place "degraded" and "down" are defined,
  so the registry, dashboards, and alerting can't drift out of sync with
  each other.
- **Search is precomputed, not joined.** `search_index` /
  `SearchIndexRow` is a denormalized projection rebuilt whenever its
  source `Opportunity` changes, so query-time search never joins across
  `opportunities` + `opportunity_tags` + provenance tables.
- **Self-validating.** Every aggregate exports a `validateX()` function
  guarding its own structural invariants (dedup-decision/opportunity-id
  consistency, date ordering, non-negative counts, success-rate ranges,
  etc.) — the same pattern used in `lib/project-generator/models/`.

## Migrations (`migrations/`)

Six SQL files, one per table called out in the spec:

| File | Table(s) |
|---|---|
| `0001_opportunities.sql` | `opportunities` (+ shared enum types) |
| `0002_opportunity_sources.sql` | `opportunity_sources` |
| `0003_provider_sync.sql` | `provider_sync` — includes a partial unique index enforcing **at most one non-terminal sync per provider** at the database level |
| `0004_provider_health.sql` | `provider_health` |
| `0005_opportunity_tags.sql` | `tags` + `opportunity_tags` join table |
| `0006_search_index.sql` | `search_index`, with a generated `tsvector` column + GIN index for full-text keyword search |

**Renumber these before applying.** They're numbered `0001`-`0006`
assuming a fresh sequence; your existing `supabase/migrations` directory
already runs through at least `0020_seed.sql`, so rename these to
`0021_opportunities.sql` through `0026_search_index.sql` (or wherever
your sequence currently ends) before running them.

All six tables have RLS enabled: `service_role` gets full read/write
(the sync pipeline and admin tooling run under the service role key),
and `authenticated` gets read-only access to the tables end users should
be able to query directly (`opportunities`, `search_index`, `tags`,
`opportunity_tags`) — `opportunity_sources` (raw payloads) is
service-role-only since it's internal pipeline state, not user-facing
content.

## Usage

```typescript
import {
  type OpportunityProvider,
  type ProviderConfig,
  ProviderKind,
  ProviderAuthType,
  OpportunityType,
  validateProviderConfig,
} from "lib/opportunities/models";

const config: ProviderConfig = {
  id: "devpost",
  displayName: "Devpost",
  kind: ProviderKind.REST_API,
  authType: ProviderAuthType.API_KEY,
  baseUrl: "https://api.devpost.com",
  supportedTypes: [OpportunityType.HACKATHON],
  rateLimit: { requestsPerInterval: 30, intervalSeconds: 60, maxConcurrentRequests: 4 },
  retry: { maxAttempts: 4, baseDelayMs: 500, maxDelayMs: 15_000, backoffMultiplier: 2 },
  syncIntervalMinutes: 60,
  enabled: true,
  credentialEnvVarNames: ["DEVPOST_API_KEY"],
};

const problems = validateProviderConfig(config);
if (problems.length > 0) throw new Error(`Invalid provider config: ${problems.join("; ")}`);
```

## Verified

Compiled with `tsc --strict --noUnusedLocals --noUnusedParameters
--noImplicitReturns --noFallthroughCasesInSwitch` — zero errors.

## What's next

`providers/` (concrete `OpportunityProvider` implementations),
`registry/` (provider registration + health-aware selection),
`normalizer/` (shared normalization helpers providers can reuse),
`validation/` (business-rule validation beyond these structural guards),
`sync/` (incremental + background sync orchestration, retry/rate-limit
enforcement), `cache/` (a `CacheProvider` implementation using
`cache.model.ts`'s key-builder), `analytics/`, and `search/` (query
execution against `search_index`) all build on this module next, the
same way `lib/project-generator/services/` built on
`lib/project-generator/models/`.
