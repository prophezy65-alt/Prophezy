/**
 * lib/hackathons/engine/providers/devpost.provider.ts
 *
 * Ported from the working providers/sources/devpost.adapter.ts — same
 * mapping logic, same real endpoint
 * (https://devpost.com/api/hackathons — Devpost's own public site-search
 * JSON API, unauthenticated, used by their own frontend), now going
 * through BaseHackathonProvider so it gets rate limiting, retry-with-
 * backoff, and a truthful User-Agent for free instead of a raw fetch()
 * call with no resilience.
 */

import type { Hackathon } from "../../models/hackathon.model";
import { hackathonSchema, validate } from "../../validation/hackathon.validation";
import { buildHackathonId, computeRawSourceHash, inferMode, parseDeadlineText } from "../../providers/sources/normalize";
import { BaseHackathonProvider, type RateLimitConfig } from "./base-hackathon-provider";
import type { FetchOptions, FetchResult } from "../types";

const DEVPOST_API_URL = "https://devpost.com/api/hackathons";

interface DevpostApiHackathon {
  id: number;
  title: string;
  url: string;
  tagline?: string;
  themes?: { name: string }[];
  prize_amount?: string;
  submission_period_dates?: string;
  displayed_location?: { location?: string };
  organization_name?: string;
  registrations_count?: number;
}

interface DevpostApiResponse {
  hackathons: DevpostApiHackathon[];
  meta?: { total_count?: number };
}

function parsePrizeAmountUsd(raw?: string): number | undefined {
  if (!raw) return undefined;
  const numeric = raw.replace(/[^0-9.]/g, "");
  const value = parseFloat(numeric);
  return Number.isFinite(value) ? value : undefined;
}

function mapDevpostHackathon(raw: DevpostApiHackathon): Hackathon {
  const now = new Date().toISOString();
  const locationText = raw.displayed_location?.location;
  const totalPoolUsd = parsePrizeAmountUsd(raw.prize_amount);

  const base: Omit<Hackathon, "rawSourceHash" | "fetchedAt"> = {
    id: buildHackathonId("devpost", String(raw.id)),
    sourceId: "devpost",
    sourceUrl: raw.url,
    title: raw.title,
    description: raw.tagline ?? "",
    organizer: { name: raw.organization_name ?? "Devpost Organizer" },
    mode: inferMode(locationText),
    location: locationText,
    themes: (raw.themes ?? []).map((t) => t.name),
    technologies: [],
    eligibility: ["open"],
    experienceTier: ["beginner", "intermediate", "advanced"],
    // Devpost's real field is free text like "Nov 09 - 20, 2025" — parsed
    // into a real ISO deadline from that same text, never fabricated.
    // See parseDeadlineText()'s doc comment for the exact shapes handled.
    timeline: { submissionDeadline: parseDeadlineText(raw.submission_period_dates) },
    prizes: {
      totalPoolUsd,
      currency: "USD",
      tiers: totalPoolUsd ? [{ label: "Total prize pool", amountUsd: totalPoolUsd }] : [],
      hasCash: Boolean(totalPoolUsd),
      hasSwag: false,
      hasInternshipOrJobOffers: false,
    },
  };

  return { ...base, fetchedAt: now, rawSourceHash: computeRawSourceHash(base) };
}

export class DevpostProvider extends BaseHackathonProvider {
  readonly key = "devpost" as const;
  readonly displayName = "Devpost";
  readonly isImplemented = true;
  readonly accessBasis = "public_json" as const;
  // Devpost's endpoint is used by their own site search widget; no documented rate limit published, so this stays conservative rather than assuming generosity.
  protected readonly rateLimit: RateLimitConfig = { requestsPerMinute: 20, minDelayMs: 500 };

  protected healthUrl(): string {
    return `${DEVPOST_API_URL}?per_page=1`;
  }

  protected async collect(options: FetchOptions): Promise<FetchResult> {
    const limit = Math.min(options.limit ?? 20, 100);
    const url = `${DEVPOST_API_URL}?order_by=recently-added&per_page=${limit}`;

    const data = await this.request<DevpostApiResponse>(url, { accept: "json" });
    if (!Array.isArray(data.hackathons)) {
      throw new Error("Devpost response did not contain a hackathons array — API shape may have changed.");
    }

    const hackathons: Hackathon[] = [];
    for (const raw of data.hackathons) {
      try {
        const mapped = mapDevpostHackathon(raw);
        const validation = validate(hackathonSchema, mapped);
        if (validation.success) hackathons.push(validation.data);
        else this.warn(`Skipping Devpost hackathon ${raw.id} — failed schema validation: ${validation.errors?.map((e) => e.message).join("; ")}`);
      } catch (error) {
        this.warn(`Failed to map Devpost hackathon ${raw.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      hackathons,
      fetchedCount: hackathons.length,
      hasMore: (data.meta?.total_count ?? 0) > hackathons.length,
      warnings: [],
    };
  }
}
