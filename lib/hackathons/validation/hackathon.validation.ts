/**
 * hackathon.validation.ts
 * Zod schemas for every input/output boundary: provider adapter output
 * (before it's trusted as a Hackathon), user input, and AI Core JSON.
 */

import { z } from "zod";

export const hackathonSourceIdSchema = z.enum([
  "devpost", "mlh", "unstop", "devfolio", "hack2skill", "dorahacks",
  "ethglobal", "angelhack", "major_league_hacking", "github_events",
  "google_developer_events", "microsoft_events", "aws_events", "hackclub",
  "y_combinator_events",
]);

export const organizerSchema = z.object({
  name: z.string().min(1).max(150),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  isVerifiedPartner: z.boolean().optional(),
});

export const prizeTierSchema = z.object({
  label: z.string().min(1).max(100),
  amountUsd: z.number().min(0).optional(),
  description: z.string().max(300).optional(),
});

export const prizeStructureSchema = z.object({
  totalPoolUsd: z.number().min(0).optional(),
  currency: z.string().min(1).max(10),
  tiers: z.array(prizeTierSchema).max(30),
  hasCash: z.boolean(),
  hasSwag: z.boolean(),
  hasInternshipOrJobOffers: z.boolean(),
});

export const hackathonTimelineSchema = z.object({
  registrationOpensAt: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  hackingStartsAt: z.string().optional(),
  submissionDeadline: z.string().min(1),
  judgingAt: z.string().optional(),
  resultsAt: z.string().optional(),
});

export const hackathonSchema = z.object({
  id: z.string().min(1),
  sourceId: hackathonSourceIdSchema,
  sourceUrl: z.string().url(),
  title: z.string().min(1).max(250),
  description: z.string().max(20000),
  organizer: organizerSchema,
  mode: z.enum(["online", "offline", "hybrid"]),
  location: z.string().max(200).optional(),
  country: z.string().max(80).optional(),
  themes: z.array(z.string().max(80)).max(30),
  technologies: z.array(z.string().max(60)).max(50),
  eligibility: z.array(z.enum(["college", "professional", "student", "open"])).max(10),
  experienceTier: z.array(z.enum(["beginner", "intermediate", "advanced"])).max(3),
  timeline: hackathonTimelineSchema,
  prizes: prizeStructureSchema,
  rulesSummary: z.string().max(5000).optional(),
  evaluationCriteria: z.array(z.string().max(200)).max(20).optional(),
  submissionRequirements: z.array(z.string().max(200)).max(20).optional(),
  teamSizeMin: z.number().int().min(1).max(50).optional(),
  teamSizeMax: z.number().int().min(1).max(50).optional(),
  fetchedAt: z.string(),
  rawSourceHash: z.string().min(1),
});

export const hackathonUserProfileSchema = z.object({
  userId: z.string().min(1),
  skills: z.array(z.string().max(80)).max(200),
  experienceTier: z.enum(["beginner", "intermediate", "advanced"]),
  preferredThemes: z.array(z.string().max(80)).max(20),
  preferredTechnologies: z.array(z.string().max(60)).max(30),
  preferredCountries: z.array(z.string().max(80)).max(20),
  preferredMode: z.enum(["online", "offline", "hybrid"]).optional(),
  availableHoursPerWeek: z.number().min(0).max(168).optional(),
  resumeSummary: z.string().max(8000).optional(),
});

export const hackathonFiltersSchema = z.object({
  country: z.string().max(80).optional(),
  mode: z.array(z.enum(["online", "offline", "hybrid"])).optional(),
  experienceTier: z.array(z.enum(["beginner", "intermediate", "advanced"])).optional(),
  eligibility: z.array(z.enum(["college", "professional", "student", "open"])).optional(),
  minPrizePoolUsd: z.number().min(0).optional(),
  technologies: z.array(z.string().max(60)).optional(),
  themes: z.array(z.string().max(80)).optional(),
  registrationDeadlineBefore: z.string().optional(),
  submissionDeadlineBefore: z.string().optional(),
});

export const searchQuerySchema = z.object({
  domain: z.enum(["hackathon", "technology", "theme", "organizer", "company"]),
  query: z.string().min(1).max(300),
  filters: hackathonFiltersSchema.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const exportFormatSchema = z.enum(["pdf", "docx", "markdown", "html", "json"]);

// ---------------------------------------------------------------------------
// AI-output schemas
// ---------------------------------------------------------------------------

export const difficultyEstimateSchema = z.object({
  tier: z.enum(["beginner", "intermediate", "advanced"]),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string().max(400),
});

export const themeAnalysisSchema = z.object({
  primaryThemes: z.array(z.string().max(80)).max(10),
  emergingTechnologyAngles: z.array(z.string().max(120)).max(10),
  suggestedAngleForCandidate: z.string().max(400),
});

export const problemStatementAnalysisSchema = z.object({
  coreProblem: z.string().max(400),
  targetUsers: z.array(z.string().max(100)).max(10),
  suggestedApproaches: z.array(z.string().max(200)).max(10),
  commonPitfalls: z.array(z.string().max(200)).max(10),
});

export const winningStrategySchema = z.object({
  keyDifferentiators: z.array(z.string().max(200)).max(10),
  judgingFocusAreas: z.array(z.string().max(150)).max(10),
  recommendedScopeForTimeAvailable: z.string().max(500),
  risksToAvoid: z.array(z.string().max(200)).max(10),
});

export const hackathonIdeaSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(150),
  pitch: z.string().max(500),
  problemSolved: z.string().max(400),
  targetUsers: z.array(z.string().max(100)).max(10),
  keyFeatures: z.array(z.string().max(150)).max(15),
  techStackSuggestion: z.array(z.string().max(60)).max(20),
  noveltyScore: z.number().min(0).max(100),
  feasibilityScore: z.number().min(0).max(100),
});

export const hackathonIdeaListSchema = z.object({ ideas: z.array(hackathonIdeaSchema).max(10) });

export const architecturePlanSchema = z.object({
  overview: z.string().max(600),
  frontend: z.array(z.string().max(100)).max(15),
  backend: z.array(z.string().max(100)).max(15),
  database: z.string().max(200),
  apis: z.array(z.string().max(150)).max(20),
  deployment: z.array(z.string().max(150)).max(10),
  folderStructure: z.array(z.string().max(150)).max(50),
});

export const projectComplexityEstimateSchema = z.object({
  complexity: z.enum(["low", "medium", "high", "very-high"]),
  estimatedDevelopmentHours: z.number().min(0).max(2000),
  riskFactors: z.array(z.string().max(200)).max(10),
  successProbabilityPercent: z.number().min(0).max(100),
});

export const learningResourceListSchema = z.object({
  resources: z.array(
    z.object({
      title: z.string().max(150),
      url: z.string().url().optional(),
      type: z.enum(["course", "docs", "video", "article", "repo"]),
    })
  ).max(15),
});

export const plannerMilestoneSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(150),
  description: z.string().max(500),
  dueAt: z.string().optional(),
  order: z.number().int().nonnegative(),
  estimatedHours: z.number().min(0).max(500),
});

export const preparationTimelineAiSchema = z.object({
  milestones: z.array(plannerMilestoneSchema).min(1).max(30),
});

export const checklistItemsAiSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(1).max(200),
      category: z.enum(["submission", "presentation", "demo", "judging"]),
    })
  ).max(50),
});

export const pitchOutlineSchema = z.object({
  hookLine: z.string().max(200),
  problemSlide: z.string().max(400),
  solutionSlide: z.string().max(400),
  demoFlow: z.array(z.string().max(200)).max(10),
  impactSlide: z.string().max(400),
  closingLine: z.string().max(200),
});

export const readmeContentSchema = z.object({ markdown: z.string().max(20000) });

/**
 * Validates arbitrary data against a schema and returns a typed, safe
 * result instead of throwing.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: { path: string; message: string }[] } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  };
}
