# Internship Discovery & Aggregation Engine

A self-contained backend module for Prophezy. Everything lives under
`lib/internships/` plus a set of route handlers, two migrations, and two
workflows. No existing Prophezy module is modified.

---

## 1. What it does

```
Scheduler → Provider → Normalizer → Deduplication → Ranking → Matching
         → Store → Search Index → Recommendation → Notifications
```

- **Aggregates** internship postings from external sources on a schedule.
- **Normalizes** every posting into one schema — compensation converted to a
  comparable INR-per-month figure, locations resolved to city/state/country,
  eligibility (degree, branch, graduation year, CGPA) extracted from prose.
- **Deduplicates** the same role listed on several boards into a single record
  that keeps every apply link.
- **Ranks and matches** against a student profile, producing a match score, an
  ATS score, a skill gap, an eligibility verdict, and a plain-English
  explanation.
- **Serves** hybrid keyword + semantic search, filters, saved lists, an
  application tracker, recommendations, and notification digests.

---

## 2. Install

### 2.1 Copy the files

| From the bundle | To your repo |
| --- | --- |
| `lib/internships/` | `lib/internships/` |
| `app/api/internships/` | `app/api/internships/` |
| `supabase/migrations/*.sql` | `supabase/migrations/` |
| `scripts/run-sync.ts`, `scripts/verify-pipeline.ts` | `scripts/` |
| `.github/workflows/*.yml` | `.github/workflows/` |
| `.env.internships.example` | merge into your `.env.local` |

### 2.2 Dependencies

The engine deliberately adds **no new runtime dependencies**. It uses the
`@supabase/supabase-js` client and `fetch` you already have. For the CLI and CI
scripts:

```bash
npm i -D tsx
```

### 2.3 Run the migrations, in order

```bash
supabase migration up
# or, against a remote project:
supabase db push
```

1. `20260723090000_internship_engine.sql` — enums, tables, indexes. Requires the
   `vector` and `pg_trgm` extensions; the migration enables both.
2. `20260723090100_internship_functions_rls.sql` — triggers, the
   `match_internships` pgvector RPC, analytics views, RLS policies, provider seed
   rows.

The migration adds only new tables. It never alters an existing one, and student
records key off `auth.users`.

### 2.4 Environment

Copy from `.env.internships.example`. The minimum to boot is
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and
`INTERNSHIP_SYNC_SECRET`. Everything else degrades gracefully: with no provider
credentials at all, the four keyless providers still sync.

### 2.5 Bind the host app (recommended, 10 lines)

The engine ships working fallbacks for both, so this step is optional — but
binding avoids a second Gemini client and a second auth path.

```ts
// instrumentation.ts
export async function register() {
  const { setAIRunner } = await import('@/lib/internships/ai/engine.adapter');
  const { setSessionResolver } = await import('@/lib/internships/http/auth');
  const { runAI, embed } = await import('@/lib/ai/engine');
  const { createClient } = await import('@/lib/supabase/server');

  setAIRunner({ run: runAI, embed });

  setSessionResolver(async () => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  });
}
```

Point `internship_profiles.resume_text` / `resume_embedding` at Resume Studio's
output and resume matching starts working immediately.

### 2.6 Verify

```bash
npx tsc --noEmit
npx tsx scripts/verify-pipeline.ts   # no network, no DB, no AI
npx tsx scripts/run-sync.ts sync --providers=remotive
```

---

## 3. Providers

50 sources are registered. **10 have real implementations** — every source with
a public, documented, terms-permitted API:

| Provider | Auth | Notes |
| --- | --- | --- |
| Greenhouse | none | Public job board API; set `GREENHOUSE_BOARD_TOKENS` |
| Lever | none | Public postings API; set `LEVER_SITES` |
| Ashby | none | Public posting API; set `ASHBY_BOARDS` |
| Adzuna | app id + key | Free tier; multi-country |
| Jooble | API key | Free on request |
| The Muse | optional key | Works unauthenticated at a lower rate limit |
| Remotive | none | Public API |
| RemoteOK | none | Public API |
| We Work Remotely | none | RSS |
| Arbeitnow | none | Public API |

**The other 40 are registered stubs** — Internshala, LinkedIn, Naukri, Indeed,
Unstop, Glassdoor, Wellfound, the government and PSU portals, the big-tech
career sites, and the rest. They report `status: 'unsupported'`, return zero
results, and **make no network calls**.

This is deliberate. Those sites have no public API and their terms prohibit
automated collection. Scraping them would have violated the "respect provider
terms of service, no scraping" requirement in the spec, and would put the
platform at legal risk. They are wired into the registry so that the moment you
obtain a partner API or an official feed, you swap one line.

### Adding a real provider

```ts
// 1. lib/internships/providers/aggregators/internshala.provider.ts
export class InternshalaProvider extends BaseProvider {
  async fetchPage(cursor: string | null): Promise<ProviderPage> { /* ... */ }
}

// 2. lib/internships/providers/index.ts — one line
internshala: () => new InternshalaProvider(),
```

The scheduler, health monitoring, filters, analytics, and admin surfaces pick it
up from its existing descriptor. Nothing else changes.

---

## 4. API

All routes are `app/api/internships/`.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | optional | Browse and filter the catalogue |
| GET | `/search` | optional | `mode=keyword\|semantic\|hybrid` (default hybrid) |
| GET | `/[id]` | optional | Detail + the caller's match + similar roles |
| GET/POST/DELETE | `/saved` | user | Saved list |
| GET/PATCH | `/applications` | user | Application tracker + funnel |
| GET | `/recommendations` | user | Personalised feed (`?force=true` to bypass cache) |
| GET/POST | `/notifications` | user | List / mark read |
| POST | `/notifications/dispatch` | sync secret | `{ job: daily\|weekly\|alerts\|deadlines }` |
| POST/GET | `/sync` | sync secret | Trigger a run / read run history and health |
| GET | `/analytics` | user | Platform metrics + provider health |

User routes resolve identity through the bound session resolver. Machine routes
require `Authorization: Bearer $INTERNSHIP_SYNC_SECRET`, compared with
`timingSafeEqual`.

Pagination is cursor-based (opaque base64url). Errors return a consistent
`{ error: { code, message } }` envelope.

---

## 5. Scheduling

`.github/workflows/internship-sync.yml` runs:

| Cron (UTC) | Job |
| --- | --- |
| `0 */4 * * *` | Incremental sync |
| `30 19 * * *` | Full sync + health sweep + deadline reminders |
| `30 2 * * *` | New-posting alerts + daily digest |
| `0 3 * * 1` | Weekly digest |

Add the secrets and variables listed in the workflow's `env:` block to your
repository settings. `workflow_dispatch` lets you trigger any mode by hand.

If you'd rather not use Actions, hit `POST /api/internships/sync` from a
Supabase scheduled function or any cron service with the same bearer token.

**Incremental** syncs only pull postings newer than each provider's last
successful run. A provider that fails five consecutive times is skipped until
its next health check clears — one broken source can't stall the pipeline.

---

## 6. Design notes worth knowing

**AI is used sparingly and never on the hot path.** Normalization runs a
deterministic regex pass first and only calls Gemini for postings too thin to
parse. Matching heuristically pre-ranks the catalogue and sends only the top ~25
to the model. Every AI path has a deterministic fallback, so an outage degrades
quality rather than causing an outage of your own.

**Untrusted text never reaches the model unguarded.** Posting descriptions and
resume text are wrapped in delimiters, stripped of instruction-like framing, and
preceded by an injection guard. Model output is parsed as JSON with a lenient
parser and validated before use.

**All outbound traffic goes through one file** (`utils/http.ts`) with a truthful
`User-Agent`, per-provider token-bucket rate limiting, timeouts, and retry with
backoff on transient failures only.

**RLS is on for every table.** The catalogue is readable by any authenticated
user; per-user rows (saved, applications, notifications, profiles) are
owner-scoped; sync logs and analytics views are service-role only.

**Deduplication is two-tier** — an O(n) fingerprint pass, then fuzzy comparison
blocked by company slug, so it stays linear rather than quadratic at 100k
postings. Title matching combines character trigrams with a stemmed token set;
`scripts/verify-pipeline.ts` pins nine merge/no-merge pairs against regression.

**Search is hybrid.** Postgres full-text and pgvector results are fused with
Reciprocal Rank Fusion rather than a tuned weight, which avoids re-tuning as the
corpus grows. Embeddings backfill in the background.

---

## 7. Known limits

- Embeddings are 768-dimensional with an `ivfflat` index. Past ~1M rows, switch
  to `hnsw` and re-tune `lists`.
- FX rates in `config/constants.ts` are static. Wire them to a rate API if
  cross-currency comparison needs to be exact.
- The notification service persists notifications (the in-app bell works out of
  the box) but ships no email/push transport. Bind one with
  `setNotificationTransport({ channel: 'email', deliver })`. Transport failures
  are logged and swallowed by design.
- Stub providers return nothing by design. Provider health will show 40 sources
  as `unsupported` — that is the expected steady state, not a fault.
