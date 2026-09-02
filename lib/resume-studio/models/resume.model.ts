/**
 * resume.model.ts
 * Core domain types for the Resume Studio module.
 *
 * These types are the single source of truth for what a "Resume" looks like
 * across parsing, editing, AI generation, ATS analysis, and export.
 *
 * NOTE: This module does NOT define the database schema. It defines the
 * application-level shape that services/utils operate on. Mapping to/from
 * Supabase rows should happen in a separate `resume.repository.ts` owned by
 * the Database Backend engineer.
 */

// ---------------------------------------------------------------------------
// Primitive / shared types
// ---------------------------------------------------------------------------

export type ResumeId = string;
export type UserId = string;

export type ExportFormat = "pdf" | "docx" | "markdown" | "json" | "html";

export type TemplateId =
  | "professional"
  | "modern"
  | "minimal"
  | "google"
  | "microsoft"
  | "amazon"
  | "meta"
  | "apple"
  | "academic"
  | "research"
  | "student"
  | "fresher"
  | "ai-engineer"
  | "software-engineer"
  | "data-scientist";

export interface DateRange {
  /** ISO 8601 "YYYY-MM" preferred. Free text allowed if user typed something unusual. */
  start: string;
  /** null/undefined means "current" */
  end?: string | null;
  isCurrent?: boolean;
}

export interface Link {
  label: string;
  url: string;
  type?: "github" | "linkedin" | "portfolio" | "website" | "other";
}

// ---------------------------------------------------------------------------
// Section-level types
// ---------------------------------------------------------------------------

export interface ContactInfo {
  fullName: string;
  email?: string;
  phone?: string;
  location?: string;
  links: Link[];
}

export interface SummarySection {
  headline?: string;
  summary?: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  dateRange: DateRange;
  gpa?: string;
  location?: string;
  highlights?: string[];
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  dateRange: DateRange;
  location?: string;
  bullets: string[];
  isInternship?: boolean;
  techStack?: string[];
}

export interface ProjectEntry {
  id: string;
  name: string;
  description?: string;
  bullets: string[];
  techStack?: string[];
  link?: string;
  dateRange?: DateRange;
}

export interface SkillGroup {
  id: string;
  category: string; // e.g. "Languages", "Frameworks", "Tools"
  items: string[];
}

export interface CertificateEntry {
  id: string;
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}

export interface AchievementEntry {
  id: string;
  title: string;
  description?: string;
  date?: string;
}

export type ResumeSectionType =
  | "summary"
  | "experience"
  | "education"
  | "projects"
  | "skills"
  | "certificates"
  | "achievements"
  | "links";

export interface SectionConfig {
  type: ResumeSectionType;
  visible: boolean;
  order: number;
  customTitle?: string;
}

// ---------------------------------------------------------------------------
// Aggregate Resume type
// ---------------------------------------------------------------------------

export interface ResumeContent {
  contact: ContactInfo;
  summary: SummarySection;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  skills: SkillGroup[];
  certificates: CertificateEntry[];
  achievements: AchievementEntry[];
  sectionOrder: SectionConfig[];
}

export interface Resume {
  id: ResumeId;
  userId: UserId;
  title: string;
  templateId: TemplateId;
  content: ResumeContent;
  targetRole?: string;
  targetJobDescription?: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
}

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

export interface ResumeVersion {
  id: string;
  resumeId: ResumeId;
  version: number;
  content: ResumeContent;
  label?: string;
  createdAt: string;
  createdBy: UserId;
  changeSummary?: string;
}

export interface VersionDiffEntry {
  path: string; // e.g. "experience[0].bullets[2]"
  changeType: "added" | "removed" | "modified";
  before?: string;
  after?: string;
}

export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  entries: VersionDiffEntry[];
}

// ---------------------------------------------------------------------------
// ATS Analysis
// ---------------------------------------------------------------------------

export type AtsCategory =
  | "keywords"
  | "skills"
  | "experience"
  | "education"
  | "projects"
  | "formatting"
  | "sections"
  | "length"
  | "action_verbs"
  | "grammar"
  | "numbers"
  | "achievements"
  | "missing_content"
  | "weak_sentences";

export interface AtsIssue {
  category: AtsCategory;
  severity: "high" | "medium" | "low";
  message: string;
  location?: string; // e.g. "experience[1].bullets[0]"
  suggestion?: string;
}

export interface AtsCategoryScore {
  category: AtsCategory;
  score: number; // 0-100
  maxScore: number;
  issues: AtsIssue[];
}

export interface AtsReport {
  overallScore: number; // 0-100
  categoryScores: AtsCategoryScore[];
  matchedKeywords: string[];
  missingKeywords: string[];
  summary: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export type ParsedFileType = "pdf" | "docx" | "txt" | "markdown";

export interface ParseResult {
  success: boolean;
  content: Partial<ResumeContent>;
  rawText: string;
  warnings: string[];
  sourceType: ParsedFileType;
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

export type AiTaskType =
  | "improve_summary"
  | "rewrite_experience"
  | "improve_project"
  | "improve_skills"
  | "generate_achievement"
  | "optimize_keywords"
  | "suggest_missing_skills"
  | "improve_grammar"
  | "improve_readability"
  | "reduce_repetition"
  | "generate_internship"
  | "generate_cover_letter"
  | "generate_linkedin_about"
  | "generate_portfolio_bio"
  | "generate_github_bio"
  | "humanize";

export interface AiGenerationRequest {
  task: AiTaskType;
  input: string;
  context?: {
    targetRole?: string;
    company?: string;
    jobDescription?: string;
    tone?: "professional" | "casual" | "confident" | "concise";
  };
}

export interface AiGenerationResult {
  task: AiTaskType;
  output: string;
  alternatives?: string[];
}

// ---------------------------------------------------------------------------
// Result / error envelope used across services
// ---------------------------------------------------------------------------

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function success<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function failure<T>(
  code: string,
  message: string,
  details?: unknown
): ServiceResult<T> {
  return { ok: false, error: { code, message, details } };
}
