/**
 * app/app/interview-lab/types.ts
 *
 * Frontend-facing types for the Interview Lab. Domain shapes are imported
 * type-only from the module's model (no runtime/server code is pulled into
 * the client bundle), and the API envelope/response shapes mirror what the
 * route handlers return.
 */
import type {
  AnalyticsSnapshot,
  ExportFormat,
  InterviewEvaluation,
  InterviewQuestion,
  InterviewSession,
  InterviewType,
  Seniority,
  SessionStatus,
  SkillScore,
} from "@/lib/interview/models/interview.model";

export type {
  AnalyticsSnapshot,
  ExportFormat,
  InterviewEvaluation,
  InterviewQuestion,
  InterviewSession,
  InterviewType,
  Seniority,
  SessionStatus,
  SkillScore,
};

export interface CreateSessionResponse {
  session: InterviewSession;
  questions: InterviewQuestion[];
}

export interface SubmitAnswerResponse {
  answerId: string;
  evaluation: InterviewEvaluation;
}

export interface SessionDetailItem {
  question: InterviewQuestion;
  answerText: string | null;
  evaluation: InterviewEvaluation | null;
}

export interface SessionDetail {
  session: InterviewSession;
  items: SessionDetailItem[];
  overallScore: number;
  answeredCount: number;
}

/** Row shape returned by GET /api/interview/sessions (raw DB columns). */
export interface SessionListItem {
  id: string;
  role: string;
  interview_type: string;
  company: string | null;
  seniority: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
}

export interface RoadmapItem {
  topic: string;
  priority: "high" | "medium" | "low";
  reason: string;
  suggestedActions: string[];
}

export interface SkillGap {
  weakSkills: SkillScore[];
  strongSkills: SkillScore[];
  roadmap: RoadmapItem[];
}

export interface CompleteSessionResponse {
  status: "completed" | "abandoned";
  skillGap: SkillGap | null;
  analytics: AnalyticsSnapshot | null;
}

export interface CompanyContext {
  knownFocusAreas: string[];
  typicalRounds: string[];
  notes: string;
}

/** Everything the report view needs after a run is completed. */
export interface AnsweredItem {
  question: InterviewQuestion;
  answerText: string;
  evaluation: InterviewEvaluation;
}

export interface FinishedSession {
  session: InterviewSession;
  items: AnsweredItem[];
  overallScore: number;
  skillGap: SkillGap | null;
  analytics: AnalyticsSnapshot | null;
}

export interface StartSessionForm {
  role: string;
  interviewType: InterviewType;
  seniority: Seniority;
  company: string;
  jobDescription: string;
  skills: string;
  questionCount: number;
}

// --- option lists for the setup form ---------------------------------------

export const INTERVIEW_TYPES: { value: InterviewType; label: string }[] = [
  { value: "hr", label: "HR / Screening" },
  { value: "technical", label: "Technical" },
  { value: "coding", label: "Coding (DSA)" },
  { value: "behavioral", label: "Behavioral (STAR)" },
  { value: "system-design", label: "System Design" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "full-stack", label: "Full-Stack" },
  { value: "ai-ml", label: "AI / ML" },
  { value: "data-science", label: "Data Science" },
  { value: "software-engineering", label: "Software Engineering" },
  { value: "devops", label: "DevOps" },
  { value: "cloud", label: "Cloud" },
  { value: "cyber-security", label: "Cyber Security" },
  { value: "business-analyst", label: "Business Analyst" },
  { value: "product-manager", label: "Product Manager" },
  { value: "research", label: "Research" },
  { value: "medical", label: "Medical" },
  { value: "law", label: "Law" },
  { value: "mba", label: "MBA / Case" },
  { value: "college-viva", label: "College Viva" },
  { value: "school-viva", label: "School Viva" },
  { value: "practical-exam", label: "Practical Exam" },
];

export const SENIORITIES: { value: Seniority; label: string }[] = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "staff+", label: "Staff+" },
];

export const SCORE_DIMENSIONS: { key: keyof InterviewEvaluation; label: string }[] = [
  { key: "correctness", label: "Correctness" },
  { key: "technicalDepth", label: "Technical depth" },
  { key: "problemSolving", label: "Problem solving" },
  { key: "logic", label: "Logic" },
  { key: "completeness", label: "Completeness" },
  { key: "communication", label: "Communication" },
  { key: "clarity", label: "Clarity" },
  { key: "confidence", label: "Confidence" },
  { key: "grammar", label: "Grammar" },
  { key: "professionalism", label: "Professionalism" },
];

export function interviewTypeLabel(value: string): string {
  return INTERVIEW_TYPES.find((t) => t.value === value)?.label ?? value;
}
