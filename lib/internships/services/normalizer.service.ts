import type { EligibilitySpec, NormalizedInternship } from '../types';
import { getAIRunner } from '../ai/engine.adapter';
import { buildEnrichmentPrompt, ENRICHMENT_SYSTEM, type EnrichmentOutput } from '../ai/prompts';
import { createLogger } from '../utils/logger';
import { dedupeSkills } from '../utils/skills';
import { parseDurationMonths } from '../utils/date';
import { mapWithConcurrency } from '../utils/retry';
import { normalizeTitle } from '../utils/text';

const log = createLogger('internships.normalizer');

const DEGREE_PATTERNS: Array<[RegExp, string]> = [
  [/\bb\.?\s?tech\b|bachelor of technology/i, 'B.Tech'],
  [/\bb\.?\s?e\.?\b(?!\w)|bachelor of engineering/i, 'B.E.'],
  [/\bm\.?\s?tech\b|master of technology/i, 'M.Tech'],
  [/\bb\.?\s?sc\b|bachelor of science/i, 'B.Sc'],
  [/\bm\.?\s?sc\b|master of science/i, 'M.Sc'],
  [/\bmba\b|master of business/i, 'MBA'],
  [/\bbba\b/i, 'BBA'],
  [/\bb\.?\s?com\b/i, 'B.Com'],
  [/\bmca\b/i, 'MCA'],
  [/\bbca\b/i, 'BCA'],
  [/\bph\.?\s?d\b|doctoral/i, 'PhD'],
];

const BRANCH_PATTERNS: Array<[RegExp, string]> = [
  [/computer science|\bcse?\b(?!\w)/i, 'Computer Science'],
  [/information technology|\bit\b(?= branch| stream)/i, 'Information Technology'],
  [/electronics.{0,20}communication|\bece\b/i, 'Electronics & Communication'],
  [/electrical|\beee\b/i, 'Electrical'],
  [/mechanical|\bmech\b/i, 'Mechanical'],
  [/civil engineering/i, 'Civil'],
  [/chemical engineering/i, 'Chemical'],
  [/data science/i, 'Data Science'],
  [/\bai\b.{0,10}\bml\b|artificial intelligence/i, 'AI & ML'],
  [/biotech/i, 'Biotechnology'],
];

/**
 * Two-stage normalization:
 *  1. deterministic regex extraction — free, runs on every posting
 *  2. optional AI enrichment — only for postings the heuristics left thin
 * This keeps per-posting AI spend near zero at aggregation scale.
 */
export class NormalizerService {
  /** Stage 1. Pure, synchronous, no network. */
  enrichDeterministic(internship: NormalizedInternship): NormalizedInternship {
    const haystack = `${internship.title}\n${internship.description}`;

    const degrees = DEGREE_PATTERNS.filter(([re]) => re.test(haystack)).map(([, label]) => label);
    const branches = BRANCH_PATTERNS.filter(([re]) => re.test(haystack)).map(([, label]) => label);
    const years = extractYears(haystack);
    const minCgpa = extractCgpa(haystack);
    const durationMonths = internship.duration.months ?? parseDurationMonths(haystack);
    const deadlineAt = internship.deadlineAt ?? extractDeadline(haystack);

    const eligibility: EligibilitySpec = {
      degrees,
      branches,
      years,
      minCgpa,
      notes: internship.eligibility.notes,
    };

    return {
      ...internship,
      normalizedTitle: normalizeTitle(internship.title),
      skills: dedupeSkills(internship.skills),
      eligibility,
      duration: { ...internship.duration, months: durationMonths },
      deadlineAt,
    };
  }

  /** True when the deterministic pass left too little structure to be useful. */
  needsAiEnrichment(internship: NormalizedInternship): boolean {
    return (
      internship.skills.length < 3 ||
      (internship.eligibility.degrees.length === 0 && internship.eligibility.branches.length === 0)
    ) && internship.description.length > 400;
  }

  /** Stage 2. Batched, concurrency-limited, failure-tolerant. */
  async enrichWithAI(
    items: readonly NormalizedInternship[],
    concurrency = 4,
  ): Promise<NormalizedInternship[]> {
    const runner = getAIRunner();
    let settled = 0;

    const results = await mapWithConcurrency(items, concurrency, async (item, index) => {
      const itemStartedAt = Date.now();
      log.info('AI item starting', { index, total: items.length, fingerprint: item.fingerprint });
      try {
        const output = await runner.runJson<EnrichmentOutput>(
          ENRICHMENT_SYSTEM,
          buildEnrichmentPrompt(item),
          { feature: 'internship_enrichment', temperature: 0.1, maxOutputTokens: 1_024 },
        );
        return this.applyEnrichment(item, output);
      } finally {
        settled += 1;
        log.info('AI item settled', {
          index,
          settled,
          total: items.length,
          durationMs: Date.now() - itemStartedAt,
        });
      }
    });

    return results.map((result, index) => {
      if (result.ok) return result.value;
      log.warn('AI enrichment failed; keeping deterministic values', {
        fingerprint: items[index]?.fingerprint,
        error: (result.error as Error).message,
      });
      return items[index] as NormalizedInternship;
    });
  }

  private applyEnrichment(item: NormalizedInternship, output: EnrichmentOutput): NormalizedInternship {
    const workMode = ['remote', 'hybrid', 'onsite'].includes(output.workMode)
      ? (output.workMode as NormalizedInternship['workMode'])
      : item.workMode;

    return {
      ...item,
      workMode,
      employmentType: (output.employmentType as NormalizedInternship['employmentType']) ?? item.employmentType,
      skills: dedupeSkills([...item.skills, ...(output.skills ?? [])]).slice(0, 25),
      duration: {
        ...item.duration,
        months: item.duration.months ?? output.durationMonths ?? null,
      },
      eligibility: {
        degrees: unique([...item.eligibility.degrees, ...(output.degrees ?? [])]),
        branches: unique([...item.eligibility.branches, ...(output.branches ?? [])]),
        years: uniqueNumbers([...item.eligibility.years, ...(output.years ?? [])]),
        minCgpa: item.eligibility.minCgpa ?? output.minCgpa ?? null,
        notes: output.summary ? unique([...item.eligibility.notes, output.summary]) : item.eligibility.notes,
      },
      tags: unique([...item.tags, ...(output.tags ?? []).map((t) => t.toLowerCase())]).slice(0, 20),
      sourceConfidence: Math.min(1, item.sourceConfidence + 0.1),
    };
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values.filter((v) => Number.isInteger(v) && v > 2_000 && v < 2_100))].sort();
}

function extractYears(text: string): number[] {
  const years = new Set<number>();
  const range = text.match(/\b(20[2-9]\d)\s*(?:-|–|to|and)\s*(20[2-9]\d)\b/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    for (let y = start; y <= end && y - start < 6; y += 1) years.add(y);
  }
  const batch = text.matchAll(/\b(?:batch|graduating|class of|passout|pass-out)\D{0,20}(20[2-9]\d)\b/gi);
  for (const match of batch) years.add(Number(match[1]));
  return [...years].sort();
}

function extractCgpa(text: string): number | null {
  const cgpa = text.match(/\b(?:cgpa|gpa|percentage)\D{0,15}?(\d(?:\.\d{1,2})?)\b/i);
  if (!cgpa?.[1]) return null;
  const value = Number(cgpa[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Convert a 4.0-scale GPA to the 10-point scale used across the platform.
  if (value <= 4) return Math.round(value * 2.5 * 10) / 10;
  return value <= 10 ? value : null;
}

function extractDeadline(text: string): string | null {
  const match = text.match(
    /(?:apply by|deadline|last date|closes on|applications close)\D{0,20}(\d{1,2}[\s/-][A-Za-z]{3,9}[\s/-]\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
  );
  if (!match?.[1]) return null;
  const parsed = new Date(match[1].replace(/[/-]/g, ' '));
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject nonsense dates far outside a plausible hiring window.
  const daysOut = (parsed.getTime() - Date.now()) / 86_400_000;
  return daysOut > -30 && daysOut < 730 ? parsed.toISOString() : null;
}
