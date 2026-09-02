import type { InternshipRecord, NormalizedInternship, UserProfileSnapshot } from '../types';
import { daysUntil } from '../utils/date';
import { jaccard } from '../utils/text';

export interface RankingSignals {
  freshness: number;
  completeness: number;
  compensation: number;
  urgency: number;
  sourceTrust: number;
  engagement: number;
}

/**
 * Deterministic, explainable scoring. No model call — this runs on every posting
 * on every sync, so it must stay cheap and stable.
 */
export class RankingService {
  /** Content quality, independent of any user. Persisted as `quality_score`. */
  qualityScore(item: NormalizedInternship): number {
    const signals = this.signals(item);
    const score =
      signals.freshness * 0.25 +
      signals.completeness * 0.35 +
      signals.compensation * 0.15 +
      signals.sourceTrust * 0.25;
    return round(clamp01(score));
  }

  /** Full ranking including engagement, used for the default feed order. */
  rankingScore(item: InternshipRecord): number {
    const signals = this.signals(item);
    const engagement = this.engagementSignal(item);
    const score =
      signals.freshness * 0.22 +
      signals.completeness * 0.24 +
      signals.compensation * 0.14 +
      signals.urgency * 0.10 +
      signals.sourceTrust * 0.15 +
      engagement * 0.15;
    return round(clamp01(score) * 100);
  }

  signals(item: NormalizedInternship): RankingSignals {
    return {
      freshness: this.freshnessSignal(item.postedAt),
      completeness: this.completenessSignal(item),
      compensation: this.compensationSignal(item),
      urgency: this.urgencySignal(item.deadlineAt),
      sourceTrust: this.sourceTrustSignal(item),
      engagement: 0,
    };
  }

  /** Half-life of 14 days. */
  private freshnessSignal(postedAt: string | null): number {
    if (!postedAt) return 0.4;
    const ageDays = Math.max(0, -(daysUntil(postedAt) ?? 0));
    return clamp01(Math.exp(-ageDays / 20));
  }

  private completenessSignal(item: NormalizedInternship): number {
    const checks = [
      item.description.length > 300,
      item.skills.length >= 3,
      item.location.city !== null || item.workMode === 'remote',
      item.compensation.normalizedMonthlyInr !== null,
      item.duration.months !== null,
      item.eligibility.degrees.length > 0 || item.eligibility.branches.length > 0,
      item.company.logoUrl !== null || item.company.website !== null,
      item.deadlineAt !== null,
    ];
    return checks.filter(Boolean).length / checks.length;
  }

  /** Log-scaled so a ₹80k stipend does not swamp every other signal. */
  private compensationSignal(item: NormalizedInternship): number {
    if (item.compensation.isUnpaid) return 0.05;
    const monthly = item.compensation.normalizedMonthlyInr;
    if (monthly === null) return 0.35;
    return clamp01(Math.log10(Math.max(monthly, 1) + 1) / Math.log10(200_001));
  }

  /** Peaks around a week out — soon enough to matter, not so soon it is unwinnable. */
  private urgencySignal(deadlineAt: string | null): number {
    const remaining = daysUntil(deadlineAt);
    if (remaining === null) return 0.4;
    if (remaining < 0) return 0;
    if (remaining <= 3) return 0.7;
    if (remaining <= 10) return 1;
    if (remaining <= 30) return 0.8;
    return 0.5;
  }

  private sourceTrustSignal(item: NormalizedInternship): number {
    const multiSourceBonus = Math.min(0.2, (item.sources.length - 1) * 0.1);
    return clamp01(item.sourceConfidence + multiSourceBonus);
  }

  private engagementSignal(item: InternshipRecord): number {
    if (item.viewCount === 0) return 0.3;
    const applyRate = item.applyCount / Math.max(item.viewCount, 1);
    const volume = clamp01(Math.log10(item.viewCount + 1) / 4);
    return clamp01(volume * 0.6 + clamp01(applyRate * 4) * 0.4);
  }

  /**
   * Cheap pre-filter used before the expensive AI match runs.
   * Reduces candidate sets from thousands to tens.
   */
  heuristicMatch(item: NormalizedInternship, profile: UserProfileSnapshot): number {
    const skillOverlap = jaccard(item.skills, profile.skills);

    const branchFit = item.eligibility.branches.length === 0 || !profile.branch
      ? 0.6
      : item.eligibility.branches.some((b) => b.toLowerCase() === profile.branch?.toLowerCase())
        ? 1
        : 0.2;

    const yearFit = item.eligibility.years.length === 0 || !profile.graduationYear
      ? 0.6
      : item.eligibility.years.includes(profile.graduationYear)
        ? 1
        : 0.1;

    const cgpaFit = item.eligibility.minCgpa === null || profile.cgpa === null
      ? 0.6
      : profile.cgpa >= item.eligibility.minCgpa
        ? 1
        : 0;

    const locationFit = profile.preferredLocations.length === 0 || item.workMode === 'remote'
      ? 0.7
      : profile.preferredLocations.some((loc) =>
          [item.location.city, item.location.state, item.location.country]
            .filter(Boolean)
            .some((part) => (part as string).toLowerCase().includes(loc.toLowerCase())))
        ? 1
        : 0.3;

    const stipendFit = profile.minStipendInr === null
      ? 0.7
      : (item.compensation.normalizedMonthlyInr ?? 0) >= profile.minStipendInr
        ? 1
        : 0.2;

    const roleFit = profile.preferredRoles.length === 0
      ? 0.6
      : profile.preferredRoles.some((role) =>
          item.normalizedTitle.includes(role.toLowerCase()))
        ? 1
        : 0.35;

    const score =
      skillOverlap * 0.30 +
      branchFit * 0.15 +
      yearFit * 0.15 +
      cgpaFit * 0.10 +
      locationFit * 0.10 +
      stipendFit * 0.08 +
      roleFit * 0.12;

    return round(clamp01(score) * 100);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
