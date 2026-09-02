/**
 * lib/hackathons/engine/services/deduplication.service.ts
 *
 * Same two-tier algorithm as lib/internships/services/deduplication.service.ts,
 * field-mapped to hackathons: company -> organizer, skills -> themes,
 * location.city/country -> mode/location/country. Reuses the internship
 * engine's own text-similarity primitives directly (trigramSimilarity,
 * titleTokenSimilarity, jaccard, slugify, normalizeTitle) rather than
 * reimplementing string-matching logic that already works.
 *
 * Unlike NormalizedInternship, Hackathon has no persisted `fingerprint`
 * field — computing one here (not stored on the model) keeps this
 * entirely self-contained without touching the existing domain type.
 */

import type { Hackathon } from "../../models/hackathon.model";
import { jaccard, normalizeTitle, slugify, titleTokenSimilarity, trigramSimilarity } from "../../../internships/utils/text";
import { createLogger } from "../../../internships/utils/logger";

const log = createLogger("hackathons.dedupe");

const DUPLICATE_TITLE_THRESHOLD = 0.82;
const DUPLICATE_TOKEN_THRESHOLD = 0.75;

export interface DedupeResult {
  merged: Hackathon[];
  duplicatesRemoved: number;
  clusters: number;
}

function fingerprint(h: Hackathon): string {
  return `${slugify(h.organizer.name)}::${normalizeTitle(h.title)}`;
}

function organizerBlockKey(h: Hackathon): string {
  return slugify(h.organizer.name) || "unknown-organizer";
}

export class HackathonDeduplicationService {
  dedupe(items: readonly Hackathon[]): DedupeResult {
    const byFingerprint = new Map<string, Hackathon>();
    let duplicatesRemoved = 0;

    for (const item of items) {
      const key = fingerprint(item);
      const existing = byFingerprint.get(key);
      if (!existing) {
        byFingerprint.set(key, item);
        continue;
      }
      byFingerprint.set(key, this.merge(existing, item));
      duplicatesRemoved += 1;
    }

    const blocks = new Map<string, Hackathon[]>();
    for (const item of byFingerprint.values()) {
      const block = blocks.get(organizerBlockKey(item)) ?? [];
      block.push(item);
      blocks.set(organizerBlockKey(item), block);
    }

    const merged: Hackathon[] = [];
    let clusters = 0;

    for (const block of blocks.values()) {
      if (block.length === 1) {
        merged.push(block[0] as Hackathon);
        continue;
      }
      const survivors: Hackathon[] = [];
      for (const candidate of block) {
        const twinIndex = survivors.findIndex((survivor) => this.isSameHackathon(survivor, candidate));
        if (twinIndex === -1) {
          survivors.push(candidate);
          continue;
        }
        survivors[twinIndex] = this.merge(survivors[twinIndex] as Hackathon, candidate);
        duplicatesRemoved += 1;
        clusters += 1;
      }
      merged.push(...survivors);
    }

    log.info("deduplication complete", { input: items.length, output: merged.length, duplicatesRemoved, clusters });
    return { merged, duplicatesRemoved, clusters };
  }

  /** Near-duplicate test within an organizer block — same reasoning as the internship engine's isSameRole(). */
  private isSameHackathon(a: Hackathon, b: Hackathon): boolean {
    const titleA = normalizeTitle(a.title);
    const titleB = normalizeTitle(b.title);
    const sameTitle =
      trigramSimilarity(titleA, titleB) >= DUPLICATE_TITLE_THRESHOLD ||
      titleTokenSimilarity(titleA, titleB) >= DUPLICATE_TOKEN_THRESHOLD;
    if (!sameTitle) return false;

    // Same hackathon should have deadlines within a few days of each other
    // even if two sources report slightly different precision.
    const deadlineA = Date.parse(a.timeline.submissionDeadline);
    const deadlineB = Date.parse(b.timeline.submissionDeadline);
    if (Number.isFinite(deadlineA) && Number.isFinite(deadlineB)) {
      const diffDays = Math.abs(deadlineA - deadlineB) / 86_400_000;
      if (diffDays > 5) return false;
    }

    const themeOverlap = jaccard(a.themes, b.themes);
    return a.themes.length < 2 || b.themes.length < 2 || themeOverlap >= 0.25;
  }

  /**
   * Merge policy, mirroring the internship engine's: longest description
   * wins as primary, union array fields, prefer non-null optional fields,
   * keep the earliest fetchedAt (first time we saw this hackathon) while
   * always sourcing the freshest raw payload's timeline/prizes (organizers
   * update these — the newer source is more likely correct).
   */
  merge(a: Hackathon, b: Hackathon): Hackathon {
    const primary = b.description.length >= a.description.length ? b : a;
    const secondary = primary === a ? b : a;
    const newer = new Date(a.fetchedAt) >= new Date(b.fetchedAt) ? a : b;

    return {
      ...primary,
      id: a.id, // keep the first-seen id stable across syncs
      title: primary.title.length >= secondary.title.length ? primary.title : secondary.title,
      organizer: {
        name: primary.organizer.name,
        website: primary.organizer.website ?? secondary.organizer.website,
        logoUrl: primary.organizer.logoUrl ?? secondary.organizer.logoUrl,
        isVerifiedPartner: primary.organizer.isVerifiedPartner || secondary.organizer.isVerifiedPartner,
      },
      location: primary.location ?? secondary.location,
      country: primary.country ?? secondary.country,
      themes: union(primary.themes, secondary.themes).slice(0, 30),
      technologies: union(primary.technologies, secondary.technologies).slice(0, 30),
      eligibility: union(primary.eligibility, secondary.eligibility) as Hackathon["eligibility"],
      experienceTier: union(primary.experienceTier, secondary.experienceTier) as Hackathon["experienceTier"],
      timeline: newer.timeline,
      prizes: (newer.prizes.totalPoolUsd ?? 0) > 0 ? newer.prizes : primary.prizes,
      rulesSummary: primary.rulesSummary ?? secondary.rulesSummary,
      evaluationCriteria: primary.evaluationCriteria ?? secondary.evaluationCriteria,
      submissionRequirements: primary.submissionRequirements ?? secondary.submissionRequirements,
      teamSizeMin: primary.teamSizeMin ?? secondary.teamSizeMin,
      teamSizeMax: primary.teamSizeMax ?? secondary.teamSizeMax,
      fetchedAt: newer.fetchedAt,
      rawSourceHash: newer.rawSourceHash,
    };
  }
}

function union<T>(a: readonly T[], b: readonly T[]): T[] {
  return [...new Set([...a, ...b])];
}
