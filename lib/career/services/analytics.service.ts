/**
 * analytics.service.ts
 * Assembles the full CareerAnalytics dashboard object: skill score,
 * readiness score, composite career score, resume strength, and
 * role/industry/company match percentages. All deterministic — no AI
 * call — so the analytics dashboard is always fast and always available.
 */

import { StudentCareerProfile, CareerAnalytics, ServiceResult, success } from "../models/career.model";
import { calculateSkillScore } from "../utils/skill-analyzer";
import { calculateLearningProgress, calculateReadinessScore, calculateCareerScore } from "../utils/progress-calculator";
import { calculateRoleMatchPercent, calculateIndustryMatchPercent, calculateCompanyMatchPercent } from "../utils/career-matcher";
import { ROLE_CATALOG, INDUSTRY_CATALOG, COMPANY_CATALOG } from "../recommendations/catalog";

export class AnalyticsService {
  /**
   * Computes full analytics for a profile. `skillGapReadinessPercent`
   * should come from SkillsService#analyzeSkillGap for the student's
   * primary target role; pass 0 if no target role is set yet.
   */
  computeAnalytics(
    profile: StudentCareerProfile,
    resumeStrength: number,
    skillGapReadinessPercent: number
  ): ServiceResult<CareerAnalytics> {
    const skillScore = calculateSkillScore(profile.skills);
    const readinessScore = calculateReadinessScore(skillGapReadinessPercent, profile.performance);
    const careerScore = calculateCareerScore({
      skillScore,
      readinessScore,
      resumeStrength,
      academic: profile.academic,
    });
    const learningProgressPercent = calculateLearningProgress(
      profile.performance,
      profile.academic.syllabusProgressPercent
    );

    const roleMatchPercent: Record<string, number> = {};
    for (const role of ROLE_CATALOG) {
      roleMatchPercent[role.title] = calculateRoleMatchPercent(profile, role);
    }

    const industryMatchPercent: Record<string, number> = {};
    for (const industry of INDUSTRY_CATALOG) {
      industryMatchPercent[industry.name] = calculateIndustryMatchPercent(profile, industry, ROLE_CATALOG);
    }

    const companyMatchPercent: Record<string, number> = {};
    for (const company of COMPANY_CATALOG) {
      companyMatchPercent[company.name] = calculateCompanyMatchPercent(profile, company, ROLE_CATALOG);
    }

    const analytics: CareerAnalytics = {
      skillScore,
      readinessScore,
      careerScore,
      resumeStrength,
      industryMatchPercent,
      companyMatchPercent,
      roleMatchPercent,
      learningProgressPercent,
      growthTimeline: this.buildGrowthTimeline(profile),
    };

    return success(analytics);
  }

  private buildGrowthTimeline(profile: StudentCareerProfile): CareerAnalytics["growthTimeline"] {
    const timeline: CareerAnalytics["growthTimeline"] = [];

    if (profile.performance.projectsCount) {
      timeline.push({ label: `${profile.performance.projectsCount} projects completed`, achievedAt: profile.generatedAt });
    }
    if (profile.performance.researchPapersCount) {
      timeline.push({ label: `${profile.performance.researchPapersCount} research papers`, achievedAt: profile.generatedAt });
    }
    if (profile.academic.syllabusProgressPercent !== undefined) {
      timeline.push({
        label: `${profile.academic.syllabusProgressPercent}% syllabus complete`,
        achievedAt: profile.generatedAt,
      });
    }

    return timeline;
  }
}
