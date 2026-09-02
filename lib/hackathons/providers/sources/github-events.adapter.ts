/**
 * github-events.adapter.ts
 * GitHub doesn't publish a structured "hackathon events" API. This adapter
 * uses GitHub's real, documented Search API
 * (https://docs.github.com/en/rest/search/search#search-repositories) to
 * surface repositories tagged with the "hackathon" topic — commonly used
 * by organizers to publish rules/starter code/submission templates. This
 * is a discovery aid, not an authoritative structured listing like
 * Devpost's, and is presented to the user as such.
 *
 * Set GITHUB_TOKEN in the environment to raise GitHub's unauthenticated
 * rate limit (60/hr -> 5000/hr).
 */

import { Hackathon } from "../../models/hackathon.model";
import { hackathonSchema, validate } from "../../validation/hackathon.validation";
import { HackathonSourceAdapter, SourceFetchOptions, SourceFetchResult } from "./source-adapter.interface";
import { buildHackathonId, computeRawSourceHash } from "./normalize";
import { logger } from "../../utils/logger";

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
      // date is surfaced instead so the UI can show recency, not a real deadline.
      submissionDeadline: repo.pushed_at,
    },
    prizes: { currency: "USD", tiers: [], hasCash: false, hasSwag: false, hasInternshipOrJobOffers: false },
  };

  return { ...base, fetchedAt: now, rawSourceHash: computeRawSourceHash(base) };
}

export class GithubEventsSourceAdapter implements HackathonSourceAdapter {
  readonly sourceId = "github_events" as const;
  readonly displayName = "GitHub (hackathon-topic repositories)";
  readonly isImplemented = true;

  async fetchHackathons(options: SourceFetchOptions = {}): Promise<SourceFetchResult> {
    const limit = Math.min(options.limit ?? 20, 100);
    const params = new URLSearchParams({
      q: "topic:hackathon",
      sort: "updated",
      order: "desc",
      per_page: String(limit),
    });

    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(`${GITHUB_SEARCH_URL}?${params.toString()}`, { headers });
    if (!response.ok) {
      throw new Error(`GitHub search failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GithubSearchResponse;

    const hackathons: Hackathon[] = [];
    for (const repo of data.items ?? []) {
      try {
        const mapped = mapGithubRepoToHackathon(repo);
        const validation = validate(hackathonSchema, mapped);
        if (validation.success) hackathons.push(validation.data);
        else logger.warn("Skipping GitHub repo that failed schema validation", { repo: repo.full_name, errors: validation.errors });
      } catch (error) {
        logger.warn("Failed to map a GitHub repo, skipping it", { repo: repo.full_name, error: (error as Error).message });
      }
    }

    return { hackathons, fetchedCount: hackathons.length, hasMore: data.total_count > hackathons.length };
  }
}
