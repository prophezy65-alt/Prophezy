/**
 * bootstrap.ts
 *
 * Wires the Career Guidance Engine's real dependencies exactly as
 * lib/career/README.md describes, and instantiates every service. Call
 * `buildCareerContext(userId)` once per request (route handlers already
 * have a request-scoped Supabase client + authenticated user).
 *
 * Cache note: `createInMemoryCacheProvider` is per-process and resets on
 * every deploy/cold start — fine for a single-instance dev/staging deploy,
 * but a real multi-instance production deployment should swap it for a
 * Redis-backed `CacheProvider` (the interface is already infra-agnostic).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAiCoreClient } from "./adapters/ai-core.adapter";
import { createCareerModuleProviders } from "./adapters/module-providers.adapter";
import { createInMemoryCacheProvider } from "./providers/cache.provider";
import { CareerRepository } from "./repository/career.repository";

import { CareerService } from "./services/career.service";
import { SkillsService } from "./services/skills.service";
import { RoadmapService } from "./services/roadmap.service";
import { RecommendationService } from "./services/recommendation.service";
import { AnalyticsService } from "./services/analytics.service";
import { CompanyService } from "./services/company.service";
import { IndustryService } from "./services/industry.service";
import { SalaryService } from "./services/salary.service";
import { ResumeAnalysisService } from "./services/resume-analysis.service";
import { LearningService } from "./services/learning.service";

// Shared across requests within the same server process — safe because it
// holds no per-user state, only TTL'd cache entries keyed by userId.
const sharedCache = createInMemoryCacheProvider();

export interface CareerContext {
  userId: string;
  repository: CareerRepository;
  careerService: CareerService;
  skillsService: SkillsService;
  roadmapService: RoadmapService;
  recommendationService: RecommendationService;
  analyticsService: AnalyticsService;
  companyService: CompanyService;
  industryService: IndustryService;
  salaryService: SalaryService;
  resumeAnalysisService: ResumeAnalysisService;
  learningService: LearningService;
}

export function buildCareerContext(db: SupabaseClient<Database>, userId: string): CareerContext {
  const aiCore = createAiCoreClient(userId);
  const providers = createCareerModuleProviders(db);

  const recommendationService = new RecommendationService(aiCore);
  const roadmapService = new RoadmapService(aiCore, sharedCache);

  return {
    userId,
    repository: new CareerRepository(db),
    careerService: new CareerService(providers, sharedCache, aiCore),
    skillsService: new SkillsService(aiCore),
    roadmapService,
    recommendationService,
    analyticsService: new AnalyticsService(),
    companyService: new CompanyService(recommendationService),
    industryService: new IndustryService(recommendationService),
    salaryService: new SalaryService(aiCore),
    resumeAnalysisService: new ResumeAnalysisService(aiCore),
    learningService: new LearningService(recommendationService, roadmapService),
  };
}
