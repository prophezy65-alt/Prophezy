/**
 * hackathon.model.ts
 * Core domain types for the Hackathon Intelligence Engine.
 */

export type UserId = string;
export type HackathonId = string;
export type SubmissionId = string;
export type IdeaId = string;

export type HackathonMode = "online" | "offline" | "hybrid";
export type ExperienceTier = "beginner" | "intermediate" | "advanced";
export type EligibilityAudience = "college" | "professional" | "student" | "open";

export type HackathonSourceId =
  | "devpost"
  | "mlh"
  | "unstop"
  | "devfolio"
  | "hack2skill"
  | "dorahacks"
  | "ethglobal"
  | "angelhack"
  | "major_league_hacking"
  | "github_events"
  | "google_developer_events"
  | "microsoft_events"
  | "aws_events"
  | "hackclub"
  | "y_combinator_events";

export type ExportFormat = "pdf" | "docx" | "markdown" | "html" | "json";

// ---------------------------------------------------------------------------
// Organizer / Prize / Timeline
// ---------------------------------------------------------------------------

export interface Organizer {
  name: string;
  website?: string;
  logoUrl?: string;
  isVerifiedPartner?: boolean;
}

export interface PrizeTier {
  label: string; // "1st Place", "Best Use of X"
  amountUsd?: number;
  description?: string;
}

export interface PrizeStructure {
  totalPoolUsd?: number;
  currency: string;
  tiers: PrizeTier[];
  hasCash: boolean;
  hasSwag: boolean;
  hasInternshipOrJobOffers: boolean;
}

export interface HackathonTimeline {
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  hackingStartsAt?: string;
  submissionDeadline: string;
  judgingAt?: string;
  resultsAt?: string;
}

// ---------------------------------------------------------------------------
// Hackathon
// ---------------------------------------------------------------------------

export interface Hackathon {
  id: HackathonId;
  sourceId: HackathonSourceId;
  sourceUrl: string;
  title: string;
  description: string;
  organizer: Organizer;
  mode: HackathonMode;
  location?: string;
  country?: string;
  themes: string[];
  technologies: string[];
  eligibility: EligibilityAudience[];
  experienceTier: ExperienceTier[];
  timeline: HackathonTimeline;
  prizes: PrizeStructure;
  rulesSummary?: string;
  evaluationCriteria?: string[];
  submissionRequirements?: string[];
  teamSizeMin?: number;
  teamSizeMax?: number;
  fetchedAt: string;
  rawSourceHash: string; // used for change detection / dedupe across sync runs
}

// ---------------------------------------------------------------------------
// Matching / Analysis
// ---------------------------------------------------------------------------

export interface HackathonMatchScore {
  hackathonId: HackathonId;
  overallMatchPercent: number;
  skillMatchPercent: number;
  themeMatchPercent: number;
  difficultyFitPercent: number;
  eligibilityOk: boolean;
  eligibilityNotes: string[];
}

export interface DifficultyEstimate {
  tier: ExperienceTier;
  confidence: "low" | "medium" | "high";
  rationale: string;
}

export interface DeadlinePrediction {
  predictedSubmissionDeadline?: string;
  confidence: "low" | "medium" | "high";
  basis: string;
}

export interface ThemeAnalysis {
  primaryThemes: string[];
  emergingTechnologyAngles: string[];
  suggestedAngleForCandidate: string;
}

export interface ProblemStatementAnalysis {
  coreProblem: string;
  targetUsers: string[];
  suggestedApproaches: string[];
  commonPitfalls: string[];
}

export interface WinningStrategy {
  keyDifferentiators: string[];
  judgingFocusAreas: string[];
  recommendedScopeForTimeAvailable: string;
  risksToAvoid: string[];
}

// ---------------------------------------------------------------------------
// Ideas & Project Planning
// ---------------------------------------------------------------------------

export interface HackathonIdea {
  id: IdeaId;
  title: string;
  pitch: string;
  problemSolved: string;
  targetUsers: string[];
  keyFeatures: string[];
  techStackSuggestion: string[];
  noveltyScore: number; // 0-100
  feasibilityScore: number; // 0-100, given typical hackathon time constraints
}

export interface ArchitecturePlan {
  overview: string;
  frontend: string[];
  backend: string[];
  database: string;
  apis: string[];
  deployment: string[];
  folderStructure: string[];
}

export interface ProjectComplexityEstimate {
  complexity: "low" | "medium" | "high" | "very-high";
  estimatedDevelopmentHours: number;
  riskFactors: string[];
  successProbabilityPercent: number;
}

export interface LearningResource {
  title: string;
  url?: string;
  type: "course" | "docs" | "video" | "article" | "repo";
}

// ---------------------------------------------------------------------------
// Preparation planning
// ---------------------------------------------------------------------------

export interface PlannerMilestone {
  id: string;
  title: string;
  description: string;
  dueAt?: string;
  order: number;
  estimatedHours: number;
}

export interface PreparationTimeline {
  hackathonId: HackathonId;
  milestones: PlannerMilestone[];
  totalEstimatedHours: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  category: "submission" | "presentation" | "demo" | "judging";
}

export interface Checklist {
  hackathonId: HackathonId;
  items: ChecklistItem[];
}

export interface PitchOutline {
  hookLine: string;
  problemSlide: string;
  solutionSlide: string;
  demoFlow: string[];
  impactSlide: string;
  closingLine: string;
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

export type TrackingStatus = "saved" | "registered" | "in_progress" | "submitted" | "completed" | "withdrawn";

export interface HackathonTrackingEntry {
  id: string;
  userId: UserId;
  hackathonId: HackathonId;
  status: TrackingStatus;
  preparationProgressPercent: number;
  submissionProgressPercent: number;
  notes?: string;
  updatedAt: string;
}

export interface Submission {
  id: SubmissionId;
  hackathonId: HackathonId;
  userId: UserId;
  projectTitle: string;
  repoUrl?: string;
  demoUrl?: string;
  submittedAt?: string;
  checklist: Checklist;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export interface HackathonRecommendation {
  hackathonId: HackathonId;
  title: string;
  rationale: string;
  confidenceScore: number;
  matchScore: HackathonMatchScore;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationType =
  | "new_hackathon"
  | "deadline_reminder"
  | "registration_reminder"
  | "submission_reminder"
  | "theme_match"
  | "technology_match";

export interface HackathonNotification {
  id: string;
  userId: UserId;
  hackathonId: HackathonId;
  type: NotificationType;
  message: string;
  triggerAt: string;
  sent: boolean;
}

// ---------------------------------------------------------------------------
// Search & pagination
// ---------------------------------------------------------------------------

export type SearchDomain = "hackathon" | "technology" | "theme" | "organizer" | "company";

export interface HackathonFilters {
  country?: string;
  mode?: HackathonMode[];
  experienceTier?: ExperienceTier[];
  eligibility?: EligibilityAudience[];
  minPrizePoolUsd?: number;
  technologies?: string[];
  themes?: string[];
  registrationDeadlineBefore?: string;
  submissionDeadlineBefore?: string;
}

export interface SearchQuery {
  domain: SearchDomain;
  query: string;
  filters?: HackathonFilters;
  cursor?: string;
  limit?: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SearchResultItem {
  id: string;
  domain: SearchDomain;
  title: string;
  snippet: string;
  score: number;
}

// ---------------------------------------------------------------------------
// User profile input (subset reused from Career Guidance / Resume Studio)
// ---------------------------------------------------------------------------

export interface HackathonUserProfile {
  userId: UserId;
  skills: string[];
  experienceTier: ExperienceTier;
  preferredThemes: string[];
  preferredTechnologies: string[];
  preferredCountries: string[];
  preferredMode?: HackathonMode;
  availableHoursPerWeek?: number;
  resumeSummary?: string;
}

// ---------------------------------------------------------------------------
// Result envelope
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
