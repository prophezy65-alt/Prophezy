/**
 * learning.service.ts
 * Orchestrates the "learning" side of career guidance: course and
 * certification recommendations (via RecommendationService) plus semester
 * planning (via RoadmapService), combined into one convenience API.
 */

import { StudentCareerProfile, Recommendation, SemesterPlan, ServiceResult, success } from "../models/career.model";
import { RecommendationService } from "./recommendation.service";
import { RoadmapService } from "./roadmap.service";

export interface LearningPlan {
  courseRecommendations: Recommendation[];
  certificationRecommendations: Recommendation[];
  semesterPlan: SemesterPlan[];
}

export class LearningService {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly roadmapService: RoadmapService
  ) {}

  async getCourseRecommendations(profile: StudentCareerProfile, limit = 6) {
    return this.recommendationService.getRecommendations(profile, "course", limit);
  }

  async getCertificationRecommendations(profile: StudentCareerProfile, limit = 6) {
    return this.recommendationService.getRecommendations(profile, "certification", limit);
  }

  async getProjectRecommendations(profile: StudentCareerProfile, limit = 6) {
    return this.recommendationService.getRecommendations(profile, "project", limit);
  }

  /**
   * Builds a full learning plan: courses + certifications + a semester
   * breakdown derived from the student's target-role roadmap.
   */
  async buildLearningPlan(
    profile: StudentCareerProfile,
    targetRole: string,
    weeksPerSemester = 16
  ): Promise<ServiceResult<LearningPlan>> {
    const [courses, certifications, roadmapResult] = await Promise.all([
      this.getCourseRecommendations(profile),
      this.getCertificationRecommendations(profile),
      this.roadmapService.generateRoadmap(profile, targetRole),
    ]);

    const semesterPlan =
      roadmapResult.ok && roadmapResult.data
        ? this.roadmapService.buildSemesterPlan(roadmapResult.data, weeksPerSemester)
        : [];

    return success<LearningPlan>({
      courseRecommendations: courses.ok && courses.data ? courses.data : [],
      certificationRecommendations: certifications.ok && certifications.data ? certifications.data : [],
      semesterPlan,
    });
  }
}
