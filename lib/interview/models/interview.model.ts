/**
 * lib/interview/models/interview.model.ts
 *
 * Domain types for the Interview Intelligence Engine. These mirror the
 * Supabase tables in supabase/migrations/0002_interview.sql — keep both
 * in sync when either changes.
 */

export type InterviewType =
  | "hr"
  | "technical"
  | "coding"
  | "behavioral"
  | "system-design"
  | "ai-ml"
  | "data-science"
  | "software-engineering"
  | "frontend"
  | "backend"
  | "full-stack"
  | "devops"
  | "cloud"
  | "cyber-security"
  | "business-analyst"
  | "product-manager"
  | "research"
  | "medical"
  | "law"
  | "mba"
  | "college-viva"
  | "school-viva"
  | "practical-exam";

export type Seniority = "intern" | "junior" | "mid" | "senior" | "staff+";

export type SessionStatus = "active" | "completed" | "abandoned";

export interface InterviewSession {
  id: string;
  userId: string;
  interviewType: InterviewType;
  role: string;
  company?: string | null;
  seniority: Seniority;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string | null;
  metadata: Record<string, unknown>;
}

export interface InterviewQuestion {
  id: string;
  sessionId: string;
  orderIndex: number;
  question: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: InterviewType;
  /** What this question was derived from, e.g. "resume", "project:ecommerce-app", "jd", "generic" */
  source: string;
  createdAt: string;
}

export interface InterviewAnswer {
  id: string;
  questionId: string;
  sessionId: string;
  answerText: string;
  submittedAt: string;
}

export interface EvaluationScores {
  correctness: number;
  communication: number;
  technicalDepth: number;
  confidence: number;
  problemSolving: number;
  clarity: number;
  grammar: number;
  completeness: number;
  logic: number;
  professionalism: number;
}

export interface InterviewEvaluation extends EvaluationScores {
  id: string;
  answerId: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  modelAnswer: string;
  alternativeAnswer: string;
  improvementPlan: string;
  suggestedResources: string[];
  createdAt: string;
}

export interface SkillScore {
  skill: string;
  score: number;
}

export interface SkillGapReport {
  weakSkills: SkillScore[];
  strongSkills: SkillScore[];
  recommendedTopics: string[];
}

export interface AnalyticsSnapshot {
  userId: string;
  totalAttempts: number;
  averageScore: number;
  topicScores: SkillScore[];
  skillScores: SkillScore[];
  strongAreas: string[];
  weakAreas: string[];
  lastComputedAt: string;
}

export interface CompanyProfile {
  name: string;
  knownFocusAreas: string[];
  typicalRounds: string[];
  notes?: string;
}

export interface RoleProfile {
  title: string;
  seniority: Seniority;
  coreSkills: string[];
}

export type ExportFormat = "pdf" | "docx" | "markdown" | "json";
