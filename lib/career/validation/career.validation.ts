/**
 * career.validation.ts
 * Zod schemas validating every input/output boundary of the Career
 * Guidance Engine: profile assembly, AI-generated JSON, and search queries.
 */

import { z } from "zod";

export const skillEntrySchema = z.object({
  name: z.string().min(1).max(80),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  source: z.enum(["resume", "quiz", "flashcards", "self-reported", "inferred"]),
});

export const academicProfileSchema = z.object({
  cgpa: z.number().min(0).max(10).optional(),
  degree: z.string().max(150).optional(),
  fieldOfStudy: z.string().max(150).optional(),
  institution: z.string().max(200).optional(),
  graduationYear: z.number().int().min(1990).max(2100).optional(),
  syllabusProgressPercent: z.number().min(0).max(100).optional(),
});

export const performanceSignalsSchema = z.object({
  quizAverageScore: z.number().min(0).max(100).optional(),
  interviewAverageScore: z.number().min(0).max(100).optional(),
  flashcardsRetentionRate: z.number().min(0).max(100).optional(),
  assignmentsCompletionRate: z.number().min(0).max(100).optional(),
  researchPapersCount: z.number().int().min(0).optional(),
  projectsCount: z.number().int().min(0).optional(),
});

export const careerPreferencesSchema = z.object({
  careerGoals: z.array(z.string().max(200)).max(20).optional(),
  preferredCountries: z.array(z.string().max(80)).max(20).optional(),
  preferredCompanies: z.array(z.string().max(120)).max(30).optional(),
  preferredIndustries: z.array(z.string().max(120)).max(20).optional(),
  targetRoles: z.array(z.string().max(120)).max(10).optional(),
  openToRemote: z.boolean().optional(),
  openToStartups: z.boolean().optional(),
  openToFreelance: z.boolean().optional(),
  higherStudiesInterest: z.array(z.enum(["MBA", "MS", "PhD", "none"])).optional(),
});

export const studentCareerProfileSchema = z.object({
  userId: z.string().min(1),
  academic: academicProfileSchema,
  skills: z.array(skillEntrySchema).max(200),
  performance: performanceSignalsSchema,
  preferences: careerPreferencesSchema,
  resumeSummary: z.string().max(8000).optional(),
  githubUrl: z.string().url().optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  targetJobDescription: z.string().max(10000).optional(),
  targetInternshipDescription: z.string().max(10000).optional(),
  generatedAt: z.string(),
});

export const searchQuerySchema = z.object({
  domain: z.enum(["career", "company", "skill", "roadmap"]),
  query: z.string().min(1).max(300),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const exportFormatSchema = z.enum(["pdf", "docx", "markdown", "html", "json"]);

// ---------------------------------------------------------------------------
// AI-output schemas — every Gemini JSON response is validated against one
// of these before being trusted, per the "output validation" requirement.
// ---------------------------------------------------------------------------

export const skillGapItemSchema = z.object({
  skill: z.string().min(1).max(80),
  currentProficiency: z.enum(["none", "beginner", "intermediate", "advanced"]),
  requiredProficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  priority: z.enum(["high", "medium", "low"]),
  reason: z.string().max(300),
});

export const skillGapAnalysisSchema = z.object({
  targetRole: z.string().min(1).max(150),
  matchedSkills: z.array(z.string().max(80)).max(100),
  gaps: z.array(skillGapItemSchema).max(50),
  overallReadinessPercent: z.number().min(0).max(100),
});

export const roadmapMilestoneSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(150),
  description: z.string().min(1).max(600),
  estimatedWeeks: z.number().min(0).max(104),
  skillsCovered: z.array(z.string().max(80)).max(20),
  recommendedResources: z.array(z.string().max(200)).max(15),
  order: z.number().int().nonnegative(),
});

export const learningRoadmapAiSchema = z.object({
  milestones: z.array(roadmapMilestoneSchema).min(1).max(30),
});

export const recommendationSchema = z.object({
  type: z.enum([
    "career_path", "role", "company", "industry", "certification", "course",
    "project", "higher_studies", "career_switch", "startup", "freelance", "remote",
  ]),
  title: z.string().min(1).max(150),
  rationale: z.string().min(1).max(500),
  confidenceScore: z.number().min(0).max(100),
  actionItems: z.array(z.string().max(250)).max(10),
  relatedLink: z.string().url().optional(),
});

export const recommendationListSchema = z.object({
  recommendations: z.array(recommendationSchema).max(30),
});

export const higherStudiesGuidanceSchema = z.object({
  program: z.enum(["MBA", "MS", "PhD"]),
  suitabilityScore: z.number().min(0).max(100),
  rationale: z.string().max(600),
  recommendedPrerequisites: z.array(z.string().max(150)).max(15),
  recommendedCountries: z.array(z.string().max(80)).max(15),
  typicalTimelineMonths: z.number().min(0).max(120),
});

export const resumeCareerAnalysisSchema = z.object({
  resumeStrengthScore: z.number().min(0).max(100),
  alignmentWithGoalsPercent: z.number().min(0).max(100),
  strengths: z.array(z.string().max(200)).max(15),
  gaps: z.array(z.string().max(200)).max(15),
  suggestedProjectsToAdd: z.array(z.string().max(200)).max(10),
  suggestedSkillsToHighlight: z.array(z.string().max(80)).max(15),
});

export const salaryEstimateSchema = z.object({
  role: z.string().min(1).max(150),
  country: z.string().min(1).max(80),
  experienceLevel: z.enum(["student", "fresher", "junior", "mid", "senior", "lead"]),
  currency: z.string().min(1).max(10),
  low: z.number().min(0),
  median: z.number().min(0),
  high: z.number().min(0),
  confidence: z.enum(["low", "medium", "high"]),
  basis: z.string().max(300),
});

/**
 * Validates arbitrary data against a schema and returns a typed, safe
 * result instead of throwing. Used at every service boundary.
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
