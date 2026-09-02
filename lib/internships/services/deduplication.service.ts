import type { NormalizedInternship, SourceRef } from '../types';
import { DUPLICATE_TITLE_THRESHOLD, DUPLICATE_TOKEN_THRESHOLD } from '../config/constants';
import { jaccard, titleTokenSimilarity, trigramSimilarity } from '../utils/text';
import { mergeSkills } from '../utils/skills';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.dedupe');

export interface DedupeResult {
  merged: NormalizedInternship[];
  duplicatesRemoved: number;
  clusters: number;
}

/**
 * Two-tier duplicate detection:
 *  1. exact fingerprint match — company + normalized title + location (O(n), catches most)
 *  2. fuzzy blocking by company slug, then trigram title similarity within the block
 *     (avoids the O(n²) all-pairs comparison that would be untenable at 100k postings)
 */
export class DeduplicationService {
  dedupe(items: readonly NormalizedInternship[]): DedupeResult {
    const byFingerprint = new Map<string, NormalizedInternship>();
    let duplicatesRemoved = 0;

    for (const item of items) {
      const existing = byFingerprint.get(item.fingerprint);
      if (!existing) {
        byFingerprint.set(item.fingerprint, item);
        continue;
      }
      byFingerprint.set(item.fingerprint, this.merge(existing, item));
      duplicatesRemoved += 1;
    }

    const blocks = new Map<string, NormalizedInternship[]>();
    for (const item of byFingerprint.values()) {
      const block = blocks.get(item.company.slug) ?? [];
      block.push(item);
      blocks.set(item.company.slug, block);
    }

    const merged: NormalizedInternship[] = [];
    let clusters = 0;

    for (const block of blocks.values()) {
      if (block.length === 1) {
        merged.push(block[0] as NormalizedInternship);
        continue;
      }
      const survivors: NormalizedInternship[] = [];

      for (const candidate of block) {
        const twinIndex = survivors.findIndex((survivor) => this.isSameRole(survivor, candidate));
        if (twinIndex === -1) {
          survivors.push(candidate);
          continue;
        }
        survivors[twinIndex] = this.merge(survivors[twinIndex] as NormalizedInternship, candidate);
        duplicatesRemoved += 1;
        clusters += 1;
      }
      merged.push(...survivors);
    }

    log.info('deduplication complete', {
      input: items.length,
      output: merged.length,
      duplicatesRemoved,
      clusters,
    });
    return { merged, duplicatesRemoved, clusters };
  }

  /** Near-duplicate test within a company block. */
  private isSameRole(a: NormalizedInternship, b: NormalizedInternship): boolean {
    // Character trigrams catch typos and punctuation drift; the stemmed token
    // set catches inflection drift ("Engineering Intern" vs "Engineer Intern")
    // that trigrams score just under the threshold. Either signal is enough.
    const sameTitle =
      trigramSimilarity(a.normalizedTitle, b.normalizedTitle) >= DUPLICATE_TITLE_THRESHOLD ||
      titleTokenSimilarity(a.normalizedTitle, b.normalizedTitle) >= DUPLICATE_TOKEN_THRESHOLD;
    if (!sameTitle) return false;

    const sameCity =
      !a.location.city || !b.location.city ||
      a.location.city.toLowerCase() === b.location.city.toLowerCase();
    const sameCountry =
      !a.location.country || !b.location.country || a.location.country === b.location.country;
    if (!sameCity || !sameCountry) return false;

    // Distinct roles at one company often differ mainly by skill stack.
    const skillOverlap = jaccard(a.skills, b.skills);
    return a.skills.length < 3 || b.skills.length < 3 || skillOverlap >= 0.3;
  }

  /**
   * Merge policy:
   *  - keep the longest description (most complete posting wins)
   *  - union the skills and tags
   *  - keep every source URL so the student can pick a provider
   *  - prefer non-null values for every optional field
   *  - keep the earliest postedAt and the latest deadlineAt
   */
  merge(a: NormalizedInternship, b: NormalizedInternship): NormalizedInternship {
    const primary = b.description.length > a.description.length ? b : a;
    const secondary = primary === a ? b : a;

    return {
      ...primary,
      fingerprint: a.fingerprint,
      title: primary.title.length >= secondary.title.length ? primary.title : secondary.title,
      company: {
        name: primary.company.name,
        slug: primary.company.slug,
        website: primary.company.website ?? secondary.company.website,
        logoUrl: primary.company.logoUrl ?? secondary.company.logoUrl,
        domain: primary.company.domain ?? secondary.company.domain,
      },
      location: {
        city: primary.location.city ?? secondary.location.city,
        state: primary.location.state ?? secondary.location.state,
        country: primary.location.country ?? secondary.location.country,
        raw: primary.location.raw ?? secondary.location.raw,
      },
      compensation:
        primary.compensation.normalizedMonthlyInr !== null
          ? primary.compensation
          : secondary.compensation,
      duration: {
        months: primary.duration.months ?? secondary.duration.months,
        raw: primary.duration.raw ?? secondary.duration.raw,
      },
      skills: mergeSkills(primary.skills, secondary.skills).slice(0, 30),
      eligibility: {
        degrees: union(primary.eligibility.degrees, secondary.eligibility.degrees),
        branches: union(primary.eligibility.branches, secondary.eligibility.branches),
        years: [...new Set([...primary.eligibility.years, ...secondary.eligibility.years])].sort(),
        minCgpa: primary.eligibility.minCgpa ?? secondary.eligibility.minCgpa,
        notes: union(primary.eligibility.notes, secondary.eligibility.notes),
      },
      descriptionHtml: primary.descriptionHtml ?? secondary.descriptionHtml,
      postedAt: earliest(primary.postedAt, secondary.postedAt),
      deadlineAt: latest(primary.deadlineAt, secondary.deadlineAt),
      tags: union(primary.tags, secondary.tags).slice(0, 25),
      sources: dedupeSources([...primary.sources, ...secondary.sources]),
      sourceConfidence: Math.max(primary.sourceConfidence, secondary.sourceConfidence),
    };
  }
}

function union(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b].map((v) => v.trim()).filter(Boolean))];
}

function dedupeSources(sources: readonly SourceRef[]): SourceRef[] {
  const seen = new Map<string, SourceRef>();
  for (const source of sources) {
    seen.set(`${source.provider}:${source.externalId}`, source);
  }
  return [...seen.values()].slice(0, 12);
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}
