/**
 * career.model.ts
 * Core domain types for the Career Guidance Intelligence Engine.
 *
 * This module NEVER redefines types owned by other modules (Resume,
 * Interview, Quiz, etc). Where career guidance needs data from those
 * modules, it imports summary/analytics shapes via the `providers/`
 * interfaces instead of duplicating their models.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type UserId = string;
export type CareerId = string;
export type RoleId = string;
export type IndustryId = string;
export type CompanyId = string;
export type RoadmapId = string;

export type ExperienceLevel = "student" | "fresher" | "junior" | "mid" | "senior" | "lead";
export type StudyDestinationCountry = string; // ISO country name/code, free-form by design

export type ExportFormat = "pdf" | "docx" | "markdown" | "html" | "json";

// ---------------------------------------------------------------------------
// Student profile — the aggregated input to the whole engine
// ---------------------------------------------------------------------------

export interface AcademicProfile {
  cgpa?: number;
  degree?: string;
  fieldOfStudy?: string;
  institution?: string;
  graduationYear?: number;
  syllabusProgressPercent?: number;
}

export interface SkillEntry {
  name: string;
  proficiency?: "beginner" | "intermediate" | "advanced" | "expert";
  source: "resume" | "quiz" | "flashcards" | "self-reported" | "inferred";
}

export interface PerformanceSignals {
  quizAverageScore?: number; // 0-100
  interviewAverageScore?: number; // 0-100
  flashcardsRetentionRate?: number; // 0-100
  assignmentsCompletionRate?: number; // 0-100
  researchPapersCount?: number;
  projectsCount?: number;
}

export interface CareerPreferences {
  careerGoals?: string[];
  preferredCountries?: string[];
  preferredCompanies?: string[];
  preferredIndustries?: string[];
  targetRoles?: string[];
  openToRemote?: boolean;
  openToStartups?: boolean;
  openToFreelance?: boolean;
  higherStudiesInterest?: ("MBA" | "MS" | "PhD" | "none")[];
}

/**
 * The single aggregated input object the whole engine reasons over.
 * Built by career.service.ts from data pulled through `providers/`.
 */
export interface StudentCareerProfile {
  userId: UserId;
  academic: AcademicProfile;
  skills: SkillEntry[];
  performance: PerformanceSignals;
  preferences: CareerPreferences;
  resumeSummary?: string; // flattened text from Resume Studio
  githubUrl?: string;
  linkedinUrl?: string;
  targetJobDescription?: string;
  targetInternshipDescription?: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Roles / Industries / Companies
// ---------------------------------------------------------------------------

export interface Role {
  id: RoleId;
  title: string;
  domain: string;
  description: string;
  coreSkills: string[];
  niceToHaveSkills: string[];
  seniorityLevels: ExperienceLevel[];
  averageSalaryRangeUsd?: [number, number];
}

export interface Industry {
  id: IndustryId;
  name: string;
  description: string;
  growthOutlook: "declining" | "stable" | "growing" | "high-growth";
  emergingSkills: string[];
  relatedRoles: RoleId[];
}

export interface Company {
  id: CompanyId;
  name: string;
  industry: string;
  size: "startup" | "mid-size" | "large" | "enterprise";
  hiringFocusAreas: string[];
  knownForRoles: string[];
  interviewStyleNotes?: string;
}

// ---------------------------------------------------------------------------
// Skill gap + roadmap
// ---------------------------------------------------------------------------

export interface SkillGapItem {
  skill: string;
  currentProficiency: "none" | "beginner" | "intermediate" | "advanced";
  requiredProficiency: "beginner" | "intermediate" | "advanced" | "expert";
  priority: "high" | "medium" | "low";
  reason: string;
}

export interface SkillGapAnalysis {
  targetRole: string;
  matchedSkills: string[];
  gaps: SkillGapItem[];
  overallReadinessPercent: number;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  estimatedWeeks: number;
  skillsCovered: string[];
  recommendedResources: string[];
  order: number;
}

export interface LearningRoadmap {
  id: RoadmapId;
  userId: UserId;
  targetRole: string;
  milestones: RoadmapMilestone[];
  totalEstimatedWeeks: number;
  createdAt: string;
}

export interface SemesterPlan {
  semesterLabel: string;
  focusAreas: string[];
  suggestedCourses: string[];
  suggestedProjects: string[];
  targetSkills: string[];
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export type RecommendationType =
  | "career_path"
  | "role"
  | "company"
  | "industry"
  | "certification"
  | "course"
  | "project"
  | "higher_studies"
  | "career_switch"
  | "startup"
  | "freelance"
  | "remote";

export interface Recommendation {
  type: RecommendationType;
  title: string;
  rationale: string;
  confidenceScore: number; // 0-100
  actionItems: string[];
  relatedLink?: string;
}

export interface HigherStudiesGuidance {
  program: "MBA" | "MS" | "PhD";
  suitabilityScore: number; // 0-100
  rationale: string;
  recommendedPrerequisites: string[];
  recommendedCountries: string[];
  typicalTimelineMonths: number;
}

// ---------------------------------------------------------------------------
// Analytics / scoring
// ---------------------------------------------------------------------------

export interface CareerAnalytics {
  skillScore: number; // 0-100
  readinessScore: number; // 0-100
  careerScore: number; // 0-100 composite
  resumeStrength: number; // 0-100, pulled from Resume Studio's ATS score
  industryMatchPercent: Record<string, number>;
  companyMatchPercent: Record<string, number>;
  roleMatchPercent: Record<string, number>;
  learningProgressPercent: number;
  growthTimeline: { label: string; achievedAt?: string; projectedAt?: string }[];
}

export interface SalaryEstimate {
  role: string;
  country: string;
  company?: string;
  experienceLevel: ExperienceLevel;
  currency: string;
  low: number;
  median: number;
  high: number;
  confidence: "low" | "medium" | "high";
  basis: string;
}

// ---------------------------------------------------------------------------
// Resume analysis (career-context, distinct from Resume Studio's ATS engine)
// ---------------------------------------------------------------------------

export interface ResumeCareerAnalysis {
  resumeStrengthScore: number;
  alignmentWithGoalsPercent: number;
  strengths: string[];
  gaps: string[];
  suggestedProjectsToAdd: string[];
  suggestedSkillsToHighlight: string[];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchDomain = "career" | "company" | "skill" | "roadmap";

export interface SearchQuery {
  domain: SearchDomain;
  query: string;
  filters?: Record<string, string | number | boolean>;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  domain: SearchDomain;
  title: string;
  snippet: string;
  score: number; // similarity score 0-1
}

// ---------------------------------------------------------------------------
// Result envelope (shared with other modules' convention)
// ---------------------------------------------------------------------------

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export function success<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function failure<T>(code: string, message: string, details?: unknown): ServiceResult<T> {
  return { ok: false, error: { code, message, details } };
}
