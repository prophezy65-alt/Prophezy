/**
 * lib/hackathons/engine/providers/github-events.provider.ts
 *
 * Ported from providers/sources/github-events.adapter.ts — GitHub's real,
 * documented Search API for repositories tagged "hackathon". A discovery
 * aid, not an authoritative structured listing like Devpost's — presented
 * to the user as such downstream. Same mapping logic as the original,
 * now going through BaseHackathonProvider for rate limiting + retry.
 */

import type { Hackathon } from "../../models/hackathon.model";
import { hackathonSchema, validate } from "../../validation/hackathon.validation";
import { buildHackathonId, computeRawSourceHash } from "../../providers/sources/normalize";
import { BaseHackathonProvider, type RateLimitConfig } from "./base-hackathon-provider";
import type { FetchOptions, FetchResult } from "../types";

const GITHUB_SEARCH_URL = "https://api.github.com/search/repositories";

interface GithubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  topics?: string[];
  pushed_at: string;
  owner: { login: string };
}

interface GithubSearchResponse {
  total_count: number;
  items: GithubRepo[];
}

function mapGithubRepoToHackathon(repo: GithubRepo): Hackathon {
  const now = new Date().toISOString();

  const base: Omit<Hackathon, "rawSourceHash" | "fetchedAt"> = {
    id: buildHackathonId("github_events", String(repo.id)),
    sourceId: "github_events",
    sourceUrl: repo.html_url,
    title: repo.full_name,
    description: repo.description ?? "Hackathon-related repository discovered via GitHub topic search.",
    organizer: { name: repo.owner.login, website: `https://github.com/${repo.owner.login}` },
    mode: "online",
    themes: repo.topics ?? [],
    technologies: [],
    eligibility: ["open"],
    experienceTier: ["beginner", "intermediate", "advanced"],
    timeline: {
      // GitHub repo search doesn't expose a submission deadline; last-push
      // date is surfaced so the UI can show recency, not a real deadline.
      submissionDeadline: repo.pushed_at,
    },
    prizes: { currency: "USD", tiers: [], hasCash: false, hasSwag: false, hasInternshipOrJobOffers: false },
  };

  return { ...base, fetchedAt: now, rawSourceHash: computeRawSourceHash(base) };
}

export class GithubEventsProvider extends BaseHackathonProvider {
  readonly key = "github_events" as const;
  readonly displayName = "GitHub (hackathon-topic repositories)";
  readonly isImplemented = true;
  readonly accessBasis = "public_api" as const;
  // GitHub's documented unauthenticated Search API limit is 10 req/min; set GITHUB_TOKEN to raise it to 30 req/min (see docs.github.com/rest/search).
  protected readonly rateLimit: RateLimitConfig = process.env.GITHUB_TOKEN
    ? { requestsPerMinute: 25, minDelayMs: 400 }
    : { requestsPerMinute: 8, minDelayMs: 2_000 };

  protected healthUrl(): string {
    return `${GITHUB_SEARCH_URL}?q=topic:hackathon&per_page=1`;
  }

  protected async collect(options: FetchOptions): Promise<FetchResult> {
    const limit = Math.min(options.limit ?? 20, 100);
    const params = new URLSearchParams({ q: "topic:hackathon", sort: "updated", order: "desc", per_page: String(limit) });

    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const data = await this.request<GithubSearchResponse>(`${GITHUB_SEARCH_URL}?${params.toString()}`, {
      headers,
      accept: "json",
    });

    const hackathons: Hackathon[] = [];
    for (const repo of data.items ?? []) {
      try {
        const mapped = mapGithubRepoToHackathon(repo);
        const validation = validate(hackathonSchema, mapped);
        if (validation.success) hackathons.push(validation.data);
        else this.warn(`Skipping GitHub repo ${repo.full_name} — failed schema validation: ${validation.errors?.map((e) => e.message).join("; ")}`);
      } catch (error) {
        this.warn(`Failed to map GitHub repo ${repo.full_name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { hackathons, fetchedCount: hackathons.length, hasMore: data.total_count > hackathons.length, warnings: [] };
  }
}
