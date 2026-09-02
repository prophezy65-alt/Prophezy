/**
 * scripts/sync-research-papers.ts
 *
 * Background Research Paper Automation Agent — run on a schedule by
 * .github/workflows/research-paper-sync.yml (and manually via
 * `npx tsx scripts/sync-research-papers.ts`).
 *
 * ============================================================================
 * WHAT CHANGED FOR THE 5,000+ PAPER LIBRARY PHASE
 * ============================================================================
 *   - Topic list broadened from 8 to ~40 real CS/AI/science domains
 *     (RESEARCH_DOMAINS below), covering every category the product spec
 *     listed (AI, ML, NLP, LLMs, CV, Robotics, RL, GenAI, RAG, Agents,
 *     Multimodal, Speech, Time Series, MLOps, Data Science, Cybersecurity,
 *     Medical AI, Bioinformatics, Quantum Computing).
 *   - Each topic is now paginated (multiple arXiv requests, offset by
 *     PAGE_SIZE) instead of a single 25-result call, so one run can pull
 *     far more than 200 papers.
 *   - Every fetched paper now gets `topics` (+ `keywords`, currently always
 *     empty — see arxiv-categories.ts) computed via
 *     lib/research/utils/arxiv-categories.ts before being upserted, so
 *     Topic Explorer's chips and ranking have real data from the moment a
 *     paper lands in the table.
 *   - Explicit delay between every arXiv request, honoring arXiv's own API
 *     usage guidance (https://info.arxiv.org/help/api/tou.html — "no more
 *     than one request every 3 seconds"). This is the actual reason a full
 *     backfill takes minutes, not seconds — it's a deliberate, documented
 *     rate limit, not a bug.
 *   - RESEARCH_SYNC_DEEP=true (or `--deep`) runs a much larger sweep for an
 *     initial backfill; the default (unset) mode stays light for the daily
 *     cron so it finishes in a couple of minutes and doesn't hammer arXiv
 *     every day for papers it already has.
 *
 * Everything from the original version is unchanged: idempotent upsert on
 * (source, source_id), the .env loader for local runs, zero Gemini calls,
 * zero touching of anything outside research_synced_papers.
 *
 * IMPORTANT — I could not actually run this against your live Supabase
 * project or arXiv from where I built it (no network egress in my
 * environment). The design is sound and the arithmetic below is real, but
 * "5,000+ papers" is only true once you've actually run this — report back
 * the real `upserted`/total count from your own run rather than taking my
 * estimate as fact. That's also what the product spec itself asks for:
 * never claim a number that isn't backed by a real import.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ArxivProvider } from "../lib/research/providers/arxiv/arxiv.provider";
import { deriveTopics } from "../lib/research/utils/arxiv-categories";
import type { Paper, PaperSearchQuery } from "../lib/research/models/paper.types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// .env loading (local runs only — see header comment in earlier versions;
// GitHub Actions passes secrets as real env vars via `env:`, nothing to load)
// ---------------------------------------------------------------------------

function loadDotEnv(path = ".env"): void {
  const fullPath = resolve(process.cwd(), path);
  if (!existsSync(fullPath)) return;

  for (const rawLine of readFileSync(fullPath, "utf-8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const isDeep = process.env.RESEARCH_SYNC_DEEP === "true" || process.argv.includes("--deep");

/** ~40 real domains covering every category the product spec named. Each
 *  becomes an arXiv `all:"<term>"` search (via ArxivProvider's existing
 *  'topic' query kind — no changes to that provider needed). */
const RESEARCH_DOMAINS = [
  // Core AI / ML
  "artificial intelligence", "machine learning", "deep learning", "neural networks",
  "supervised learning", "unsupervised learning", "self-supervised learning",
  // NLP / LLMs
  "natural language processing", "large language models", "transformer architecture",
  "text generation", "question answering", "named entity recognition",
  // RAG / retrieval
  "retrieval augmented generation", "dense retrieval", "vector search",
  // Agents
  "llm agents", "autonomous agents", "multi-agent systems",
  // Computer vision
  "computer vision", "object detection", "image segmentation", "image classification",
  // Medical
  "medical imaging", "clinical natural language processing", "medical ai",
  // Reinforcement learning
  "reinforcement learning", "policy gradient methods", "multi-agent reinforcement learning",
  // Generative AI
  "generative adversarial networks", "diffusion models", "text to image generation",
  // Multimodal
  "multimodal learning", "vision language models",
  // Speech
  "speech recognition", "speech synthesis",
  // Time series / data science
  "time series forecasting", "anomaly detection", "data science",
  // MLOps / systems
  "machine learning systems", "distributed training",
  // Cybersecurity
  "adversarial machine learning", "network security",
  // Bioinformatics
  "computational biology", "protein structure prediction", "genomics",
  // Quantum
  "quantum computing", "quantum machine learning",
  // Robotics
  "robotics", "robot learning", "autonomous navigation",
];

/** Results per arXiv request. arXiv supports much larger pages, but a
 *  smaller page size keeps any single request's response body light and
 *  keeps failures cheap to retry. */
const PAGE_SIZE = 50;
/** Pages per domain. Light mode (daily cron): 1 page (~50/domain, ~2,000
 *  total before dedup). Deep mode (initial backfill / manual --deep run):
 *  6 pages (~300/domain, ~12,000 before dedup — comfortably clears 5,000
 *  unique real papers after cross-domain dedup). */
const PAGES_PER_DOMAIN = Number(process.env.RESEARCH_SYNC_PAGES_PER_DOMAIN ?? (isDeep ? 6 : 1));
/** arXiv's own usage policy: no more than one request every 3 seconds.
 *  https://info.arxiv.org/help/api/tou.html */
const REQUEST_DELAY_MS = Number(process.env.RESEARCH_SYNC_DELAY_MS ?? 3100);

function getDomains(): string[] {
  const raw = process.env.RESEARCH_SYNC_QUERIES;
  if (!raw?.trim()) return RESEARCH_DOMAINS;
  return raw.split(",").map((q) => q.trim()).filter(Boolean);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Supabase (service-role — bypasses RLS by design; research_synced_papers
// has no regular-user write policy, see migration 0040's comments)
// ---------------------------------------------------------------------------

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set.");
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. research_synced_papers has no regular-user insert policy by " +
        "design — this script must run with the service role key, never the anon/public key."
    );
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Paper -> row mapping
// ---------------------------------------------------------------------------

interface SyncedPaperUpsertRow {
  source: string;
  source_id: string;
  title: string;
  abstract: string | null;
  authors: string[];
  venue: string | null;
  published_date: string | null;
  doi: string | null;
  arxiv_id: string | null;
  landing_url: string | null;
  pdf_url: string | null;
  html_url: string | null;
  categories: string[];
  topics: string[];
  keywords: string[];
  citation_count: number | null;
  raw: unknown;
  synced_at: string;
}

function toRow(paper: Paper): SyncedPaperUpsertRow {
  const categories = paper.fieldsOfStudy ?? [];
  return {
    source: paper.source,
    source_id: paper.sourceId,
    title: paper.title,
    abstract: paper.abstract ?? null,
    authors: paper.authors.map((a) => a.name),
    venue: paper.venue ?? null,
    published_date: normalizeDate(paper.publishedDate),
    doi: paper.identifiers.doi ?? null,
    arxiv_id: paper.identifiers.arxivId ?? null,
    landing_url: paper.links.landingPage ?? null,
    pdf_url: paper.links.pdf ?? null,
    html_url: paper.links.html ?? null,
    categories,
    // Real, deterministic — arXiv's own category codes mapped to domain
    // labels, plus keyword matches against the paper's own title/abstract.
    // See lib/research/utils/arxiv-categories.ts for exactly how.
    topics: deriveTopics(categories, paper.title, paper.abstract),
    // arXiv doesn't supply distinct keywords — left empty rather than
    // invented. See that file's header comment.
    keywords: [],
    citation_count: paper.metrics.citationCount ?? null,
    raw: paper.raw ?? null,
    synced_at: new Date().toISOString(),
  };
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length === 3) return value;
  if (parts.length === 2) return `${value}-01`;
  if (parts.length === 1 && /^\d{4}$/.test(value)) return `${value}-01-01`;
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function fetchDomain(provider: ArxivProvider, domain: string): Promise<Paper[]> {
  const papers: Paper[] = [];

  for (let page = 0; page < PAGES_PER_DOMAIN; page++) {
    const searchQuery: PaperSearchQuery = {
      kind: "topic",
      query: domain,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };

    const result = await provider.search(searchQuery);
    papers.push(...result.papers);
    console.log(JSON.stringify({ event: "sync.page_done", domain, page, found: result.papers.length }));

    // Stop paginating a domain early once arXiv returns a short page —
    // means we've exhausted what's actually available, no point spending
    // more rate-limited requests on empty pages.
    if (result.papers.length < PAGE_SIZE) break;

    const isLastPage = page === PAGES_PER_DOMAIN - 1;
    if (!isLastPage) await sleep(REQUEST_DELAY_MS);
  }

  return papers;
}

async function upsertPapers(supabase: SupabaseClient, papers: Paper[]): Promise<number> {
  if (papers.length === 0) return 0;

  const bySourceId = new Map<string, Paper>();
  for (const paper of papers) bySourceId.set(`${paper.source}:${paper.sourceId}`, paper);
  const rows = Array.from(bySourceId.values()).map(toRow);

  // Chunked upsert — a single request with thousands of rows risks hitting
  // PostgREST's payload size limit; 500-row batches stay comfortably under
  // it while still being far fewer round trips than one row at a time.
  const CHUNK_SIZE = 500;
  let totalUpserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error, count } = await supabase
      .from("research_synced_papers")
      .upsert(chunk, { onConflict: "source,source_id", count: "exact" });
    if (error) throw new Error(`Supabase upsert failed on chunk ${i / CHUNK_SIZE}: ${error.message}`);
    totalUpserted += count ?? chunk.length;
  }
  return totalUpserted;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const supabase = getSupabaseClient();
  const provider = new ArxivProvider();
  const domains = getDomains();

  console.log(
    JSON.stringify({
      event: "sync.start",
      mode: isDeep ? "deep" : "light",
      domainCount: domains.length,
      pagesPerDomain: PAGES_PER_DOMAIN,
      pageSize: PAGE_SIZE,
      estimatedRequests: domains.length * PAGES_PER_DOMAIN,
      estimatedMinutes: Math.round((domains.length * PAGES_PER_DOMAIN * REQUEST_DELAY_MS) / 60_000),
    })
  );

  const allPapers: Paper[] = [];
  const failures: { domain: string; error: string }[] = [];

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i]!;
    try {
      const papers = await fetchDomain(provider, domain);
      allPapers.push(...papers);
      console.log(JSON.stringify({ event: "sync.domain_done", domain, found: papers.length }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ domain, error: message });
      console.error(JSON.stringify({ event: "sync.domain_failed", domain, error: message }));
      // One bad domain (rate limit, transient network error) must not
      // abort the rest of the sweep.
    }

    const isLastDomain = i === domains.length - 1;
    if (!isLastDomain) await sleep(REQUEST_DELAY_MS);
  }

  if (allPapers.length === 0) {
    if (failures.length === domains.length) {
      throw new Error(`All ${domains.length} sync domains failed — see logs above. No papers were fetched.`);
    }
    console.log(JSON.stringify({ event: "sync.done", upserted: 0, tookMs: Date.now() - startedAt }));
    return;
  }

  const upserted = await upsertPapers(supabase, allPapers);

  const { count: libraryTotal } = await supabase
    .from("research_synced_papers")
    .select("*", { count: "exact", head: true });

  console.log(
    JSON.stringify({
      event: "sync.done",
      fetched: allPapers.length,
      uniqueInBatch: new Set(allPapers.map((p) => `${p.source}:${p.sourceId}`)).size,
      upserted,
      failedDomains: failures.length,
      libraryTotalAfterSync: libraryTotal ?? null,
      tookMs: Date.now() - startedAt,
    })
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ event: "sync.fatal", error: err instanceof Error ? err.message : String(err) }));
  process.exitCode = 1;
});
