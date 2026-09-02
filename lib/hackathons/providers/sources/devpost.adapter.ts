/**
 * devpost.adapter.ts
 * Devpost source adapter. Devpost exposes a public JSON endpoint used by
 * their own site search (`https://devpost.com/api/hackathons`) that
 * returns paginated hackathon listings without authentication.
 *
 * NOTE: Third-party API contracts change without notice. Verify the
 * response shape against Devpost's current output before relying on this
 * in production, and adjust `mapDevpostHackathon` if fields drift. This
 * adapter fails loudly (throws) on unexpected shapes rather than silently
 * returning malformed data.
 */

import { Hackathon } from "../../models/hackathon.model";
import { hackathonSchema, validate } from "../../validation/hackathon.validation";
import { HackathonSourceAdapter, SourceFetchOptions, SourceFetchResult } from "./source-adapter.interface";
import { buildHackathonId, computeRawSourceHash, inferMode } from "./normalize";
import { logger } from "../../utils/logger";

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
  time_left_to_submission?: string;
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
    timeline: {
      submissionDeadline: raw.submission_period_dates ?? "",
    },
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

export class DevpostSourceAdapter implements HackathonSourceAdapter {
  readonly sourceId = "devpost" as const;
  readonly displayName = "Devpost";
  readonly isImplemented = true;

  async fetchHackathons(options: SourceFetchOptions = {}): Promise<SourceFetchResult> {
    const limit = options.limit ?? 20;
    const url = `${DEVPOST_API_URL}?order_by=recently-added&per_page=${limit}`;

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Devpost fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as DevpostApiResponse;
    if (!Array.isArray(data.hackathons)) {
      throw new Error("Devpost response did not contain a hackathons array — API shape may have changed.");
    }

    const hackathons: Hackathon[] = [];
    for (const raw of data.hackathons) {
      try {
        const mapped = mapDevpostHackathon(raw);
        const validation = validate(hackathonSchema, mapped);
        if (validation.success) {
          hackathons.push(validation.data);
        } else {
          logger.warn("Skipping Devpost hackathon that failed schema validation", {
            id: raw.id,
            errors: validation.errors,
          });
        }
      } catch (error) {
        logger.warn("Failed to map a Devpost hackathon, skipping it", { id: raw.id, error: (error as Error).message });
      }
    }

    return {
      hackathons,
      fetchedCount: hackathons.length,
      hasMore: (data.meta?.total_count ?? 0) > hackathons.length,
    };
  }
}
