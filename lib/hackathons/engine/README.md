# Hackathon Aggregation Engine

Mirrors `lib/internships`' architecture exactly — provider → normalize →
dedupe → persist, with a circuit-breaker sync orchestrator on top. Where a
piece of that architecture is generic (HTTP client with rate limiting +
retry, structured logging, text-similarity primitives, the Supabase
service-role client, error types), this engine **imports it directly from
`lib/internships`** rather than reimplementing it — see each file's header
comment for exactly which internship utility it reuses.

## Folder structure

```
lib/hackathons/engine/
  types.ts                        Provider/health/sync-result contracts
  providers/
    base-hackathon-provider.ts    Template-method base every real provider extends
    stub.provider.ts              Honest placeholder for sources without a real integration yet
    provider-registry.ts          THE list — every source, one descriptor each
    devpost.provider.ts           Real — devpost.com/api/hackathons
    github-events.provider.ts     Real — GitHub Search API, topic:hackathon
  services/
    normalizer.service.ts         Deterministic cleanup (free) + optional AI enrichment (thin postings only)
    deduplication.service.ts      Fingerprint exact-match + fuzzy blocking within an organizer
    aggregator.service.ts         provider -> normalize -> dedupe -> persist for one or many providers
    sync.service.ts               Circuit breaker, incremental/full modes, expiry, health recording
  db/
    hackathon-sync.repository.ts  hackathon_sync_logs + hackathon_providers reads/writes
  jobs/
    sync.job.ts                   Entry point: runHackathonSync(), runHackathonHealthCheck(), listRegisteredSources()
```

Persistence into the `hackathons` table itself reuses the **existing**
`SupabaseHackathonRepository` (`lib/hackathons/providers/hackathon.repository.supabase.ts`)
— this engine doesn't own a second write path into that table.

## The provider interface

Every provider — real or stub — implements:

```ts
interface HackathonProvider {
  readonly key: HackathonSourceId;
  readonly displayName: string;
  readonly isImplemented: boolean;
  readonly accessBasis: "public_api" | "public_json" | "rss" | "unsupported";
  fetchAll(options?: FetchOptions): Promise<FetchResult>;
  checkHealth(): Promise<ProviderHealth>;
}
```

Real providers extend `BaseHackathonProvider` and implement two protected
methods instead of the public interface directly:

```ts
protected abstract healthUrl(): string;
protected abstract collect(options: FetchOptions): Promise<FetchResult>;
```

`fetchAll()`/`checkHealth()` (the public, required methods) are handled by
the base class — timing, warning collection, and the actual network call
(`this.request()`, which goes through the internship engine's real rate
limiter + retry-with-backoff) are already done for you.

## How to add a new provider

1. **Verify it's actually allowed first.** Does the source publish a
   documented public API, JSON endpoint, or RSS feed intended for
   third-party use? If the only way to get the data is scraping HTML or
   hitting an undocumented internal endpoint, it doesn't qualify — register
   it as a stub with an honest `integrationNote` instead (see
   `provider-registry.ts` for 13 examples, each with the specific reason).

2. Write `lib/hackathons/engine/providers/<source>.provider.ts` extending
   `BaseHackathonProvider`:

   ```ts
   export class ExampleProvider extends BaseHackathonProvider {
     readonly key = "example" as const; // must already exist in HackathonSourceId
     readonly displayName = "Example";
     readonly isImplemented = true;
     readonly accessBasis = "public_json" as const;
     protected readonly rateLimit = { requestsPerMinute: 20, minDelayMs: 500 };

     protected healthUrl() { return "https://example.com/api/hackathons?limit=1"; }

     protected async collect(options: FetchOptions): Promise<FetchResult> {
       const data = await this.request<ExampleApiResponse>(url);
       // map `data` -> Hackathon[], validate each with hackathonSchema
       return { hackathons, fetchedCount: hackathons.length, hasMore, warnings: [] };
     }
   }
   ```

3. In `provider-registry.ts`, move the entry from the `UNSUPPORTED` array
   to a proper descriptor with `factory: () => new ExampleProvider()`.

Nothing else changes — `SyncService`, the aggregator, the API routes, and
the health check all read from the registry, not a hardcoded list.

## How the scheduler works

`runHackathonSync()` (`jobs/sync.job.ts`) is the entry point. Wire it to
whatever scheduler you use the same way the internship engine's own
`scripts/run-sync.ts` + GitHub Actions workflow do — this repo didn't
include that script or workflow file, so add a `scripts/run-hackathon-sync.ts`
CLI wrapper and a matching cron workflow yourself, mirroring the
internship engine's `internships:sync`/`internships:sync:full` npm scripts
and their triggering workflow file. `runHackathonSync({ mode: "full" })`
for a full resync, `{ mode: "incremental" }` (the default) for
since-last-success-only fetching where a provider supports it.

Within one run:
1. For each **implemented** provider (stubs are skipped, not attempted):
   - Check the circuit breaker (`hackathon_providers.consecutive_failures`)
     — 5+ consecutive failures skips the provider entirely for this run
     rather than hammering a source that's clearly down.
   - Fetch (incremental mode passes `since` = last successful sync time).
   - Normalize, deduplicate, persist via the aggregator.
   - Record the run to `hackathon_sync_logs` and update
     `hackathon_providers`' health columns.
2. Delete hackathons whose submission deadline passed more than
   `retentionDays` (default 30) ago.

## How deduplication works

Two tiers, same as the internship engine:

1. **Exact fingerprint match** — `slugify(organizer.name) + normalizeTitle(title)`.
   Same fingerprint within one fetch = definitely the same hackathon,
   merged immediately.
2. **Fuzzy blocking** — candidates are grouped by organizer (blocking key),
   then within each group, pairs are compared by title similarity
   (trigram + token overlap) AND submission-deadline proximity (within 5
   days) AND theme overlap. All three roughly agreeing = merged.

Merge policy: longer description wins as the base record; array fields
(themes, technologies, eligibility, experience tiers) are unioned; the
most recently fetched source's timeline/prizes win (organizers update
these over time); the first-seen `id` is kept stable across syncs so
existing bookmarks/tracking entries pointing at that id don't break.

## How normalization works

**Stage 1 (always runs, free):** trim/lowercase/dedupe theme and
technology lists, infer `country` from location/description text via a
small keyword map when the source didn't provide one.

**Stage 2 (optional, AI):** only invoked when a hackathon has *zero*
themes AND *zero* technologies after Stage 1 AND a description long enough
to plausibly extract something from. Uses the existing `AiCoreClient`
(`lib/hackathons/providers/ai-core.provider.ts`) already wired into
`recommendation.service.ts` — no second AI bridge. Off by default in
`HackathonAggregatorService`'s constructor; pass `true` as the fourth
constructor argument to enable it for a given sync run.

## What's real vs. what's an honest stub

| Source | Status | Why |
|---|---|---|
| Devpost | ✅ Real | `devpost.com/api/hackathons` — Devpost's own public site-search JSON, unauthenticated |
| GitHub (hackathon-topic repos) | ✅ Real | GitHub's documented public Search API |
| MLH, Major League Hacking | ❌ Stub | No official public listings API (verified) |
| Devfolio | ❌ Stub | No official public API (verified) |
| Unstop, Hack2Skill, DoraHacks, ETHGlobal, AngelHack, HackClub, Y Combinator Events | ❌ Stub | No documented public aggregation API found |
| Google/Microsoft/AWS Developer Events | ❌ Stub | General event catalogs, no hackathon-specific public feed |

Turning any stub real is exactly the 3-step process above — nothing about
the engine's architecture needs to change.
