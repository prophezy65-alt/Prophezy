/**
 * module-providers.ts
 * Interfaces for every existing module the Career Guidance Engine reuses
 * data from. The Career Engine never re-implements resume parsing, quiz
 * scoring, interview analysis, etc — it pulls summarized data through
 * these narrow interfaces and the app wires real implementations in.
 *
 * Each interface is intentionally minimal: only the fields career guidance
 * actually needs, not the full internal model of the source module.
 */

import { UserId } from "../models/career.model";

// ---------------------------------------------------------------------------
// Resume Studio
// ---------------------------------------------------------------------------

export interface ResumeSummaryForCareer {
  resumeText: string; // flattened resume content
  atsScore: number; // 0-100, from Resume Studio's ATS engine
  skills: string[];
  githubUrl?: string;
  linkedinUrl?: string;
  targetRole?: string;
}

export interface ResumeStudioProvider {
  getLatestResumeSummary(userId: UserId): Promise<ResumeSummaryForCareer | null>;
}

// ---------------------------------------------------------------------------
// Interview AI
// ---------------------------------------------------------------------------

export interface InterviewPerformanceSummary {
  averageScore: number; // 0-100
  sessionsCompleted: number;
  strongAreas: string[];
  weakAreas: string[];
  lastSessionAt?: string;
}

export interface InterviewAiProvider {
  getPerformanceSummary(userId: UserId): Promise<InterviewPerformanceSummary | null>;
}

// ---------------------------------------------------------------------------
// Quiz AI
// ---------------------------------------------------------------------------

export interface QuizPerformanceSummary {
  averageScore: number; // 0-100
  quizzesTaken: number;
  strongTopics: string[];
  weakTopics: string[];
}

export interface QuizAiProvider {
  getPerformanceSummary(userId: UserId): Promise<QuizPerformanceSummary | null>;
}

// ---------------------------------------------------------------------------
// Flashcards AI
// ---------------------------------------------------------------------------

export interface FlashcardsAnalyticsSummary {
  retentionRatePercent: number;
  cardsReviewed: number;
  topicsCovered: string[];
}

export interface FlashcardsAiProvider {
  getAnalyticsSummary(userId: UserId): Promise<FlashcardsAnalyticsSummary | null>;
}

// ---------------------------------------------------------------------------
// Notes AI
// ---------------------------------------------------------------------------

export interface NotesSummary {
  topicsCovered: string[];
  totalNotes: number;
}

export interface NotesAiProvider {
  getSummary(userId: UserId): Promise<NotesSummary | null>;
}

// ---------------------------------------------------------------------------
// Assignment AI
// ---------------------------------------------------------------------------

export interface AssignmentSummary {
  completionRatePercent: number;
  totalAssignments: number;
  subjectsCovered: string[];
}

export interface AssignmentAiProvider {
  getSummary(userId: UserId): Promise<AssignmentSummary | null>;
}

// ---------------------------------------------------------------------------
// Research AI
// ---------------------------------------------------------------------------

export interface ResearchSummary {
  papersCount: number;
  topics: string[];
}

export interface ResearchAiProvider {
  getSummary(userId: UserId): Promise<ResearchSummary | null>;
}

// ---------------------------------------------------------------------------
// Project Generator
// ---------------------------------------------------------------------------

export interface ProjectsSummary {
  projectsCount: number;
  techStacksUsed: string[];
  projectTitles: string[];
}

export interface ProjectGeneratorProvider {
  getSummary(userId: UserId): Promise<ProjectsSummary | null>;
}

// ---------------------------------------------------------------------------
// Syllabus AI
// ---------------------------------------------------------------------------

export interface SyllabusProgressSummary {
  progressPercent: number;
  currentSemesterLabel?: string;
  upcomingTopics: string[];
}

export interface SyllabusAiProvider {
  getProgressSummary(userId: UserId): Promise<SyllabusProgressSummary | null>;
}

// ---------------------------------------------------------------------------
// Aggregate provider bundle — injected into CareerService as one object
// ---------------------------------------------------------------------------

export interface CareerModuleProviders {
  resumeStudio: ResumeStudioProvider;
  interviewAi: InterviewAiProvider;
  quizAi: QuizAiProvider;
  flashcardsAi: FlashcardsAiProvider;
  notesAi: NotesAiProvider;
  assignmentAi: AssignmentAiProvider;
  researchAi: ResearchAiProvider;
  projectGenerator: ProjectGeneratorProvider;
  syllabusAi: SyllabusAiProvider;
}

/**
 * Stub bundle so this module compiles and is testable standalone.
 * Replace with real implementations at app bootstrap.
 */
export function createStubModuleProviders(): CareerModuleProviders {
  const nullAsync = async () => null;
  return {
    resumeStudio: { getLatestResumeSummary: nullAsync },
    interviewAi: { getPerformanceSummary: nullAsync },
    quizAi: { getPerformanceSummary: nullAsync },
    flashcardsAi: { getAnalyticsSummary: nullAsync },
    notesAi: { getSummary: nullAsync },
    assignmentAi: { getSummary: nullAsync },
    researchAi: { getSummary: nullAsync },
    projectGenerator: { getSummary: nullAsync },
    syllabusAi: { getProgressSummary: nullAsync },
  };
}
