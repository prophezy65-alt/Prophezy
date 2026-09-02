/**
 * module-providers.ts
 * Interfaces for every existing module the Hackathon Engine reuses data
 * from. Narrow, summary-only shapes — never the full internal model of
 * the source module.
 */

import { UserId } from "../models/hackathon.model";

// ---------------------------------------------------------------------------
// Resume Studio
// ---------------------------------------------------------------------------

export interface ResumeSummaryForHackathon {
  resumeText: string;
  skills: string[];
  githubUrl?: string;
}

export interface ResumeStudioProvider {
  getLatestResumeSummary(userId: UserId): Promise<ResumeSummaryForHackathon | null>;
}

// ---------------------------------------------------------------------------
// Career Guidance AI
// ---------------------------------------------------------------------------

export interface CareerContextForHackathon {
  targetRoles: string[];
  preferredIndustries: string[];
  skillScore: number;
}

export interface CareerGuidanceProvider {
  getCareerContext(userId: UserId): Promise<CareerContextForHackathon | null>;
}

// ---------------------------------------------------------------------------
// Project Generator
// ---------------------------------------------------------------------------

export interface PastProjectsSummary {
  projectTitles: string[];
  techStacksUsed: string[];
}

export interface ProjectGeneratorProvider {
  getPastProjectsSummary(userId: UserId): Promise<PastProjectsSummary | null>;
  /** Reuses the existing project-idea generation pipeline as a building block. */
  generateProjectIdea(prompt: string): Promise<{ title: string; description: string } | null>;
}

// ---------------------------------------------------------------------------
// Interview AI
// ---------------------------------------------------------------------------

export interface InterviewReadinessSummary {
  averageScore: number;
  strongAreas: string[];
}

export interface InterviewAiProvider {
  getReadinessSummary(userId: UserId): Promise<InterviewReadinessSummary | null>;
}

// ---------------------------------------------------------------------------
// Research AI
// ---------------------------------------------------------------------------

export interface ResearchContextSummary {
  topics: string[];
  papersCount: number;
}

export interface ResearchAiProvider {
  getSummary(userId: UserId): Promise<ResearchContextSummary | null>;
}

// ---------------------------------------------------------------------------
// Notes AI / Assignment AI / Quiz AI / Flashcards AI
// ---------------------------------------------------------------------------

export interface NotesSummary {
  topicsCovered: string[];
}
export interface NotesAiProvider {
  getSummary(userId: UserId): Promise<NotesSummary | null>;
}

export interface AssignmentSummary {
  subjectsCovered: string[];
  completionRatePercent: number;
}
export interface AssignmentAiProvider {
  getSummary(userId: UserId): Promise<AssignmentSummary | null>;
}

export interface QuizPerformanceSummary {
  averageScore: number;
  strongTopics: string[];
}
export interface QuizAiProvider {
  getPerformanceSummary(userId: UserId): Promise<QuizPerformanceSummary | null>;
}

export interface FlashcardsAnalyticsSummary {
  retentionRatePercent: number;
  topicsCovered: string[];
}
export interface FlashcardsAiProvider {
  getAnalyticsSummary(userId: UserId): Promise<FlashcardsAnalyticsSummary | null>;
}

// ---------------------------------------------------------------------------
// Internship Discovery AI
// ---------------------------------------------------------------------------

export interface InternshipContextSummary {
  targetCompanies: string[];
  targetRoles: string[];
}
export interface InternshipDiscoveryProvider {
  getContextSummary(userId: UserId): Promise<InternshipContextSummary | null>;
}

// ---------------------------------------------------------------------------
// Aggregate bundle
// ---------------------------------------------------------------------------

export interface HackathonModuleProviders {
  resumeStudio: ResumeStudioProvider;
  careerGuidance: CareerGuidanceProvider;
  projectGenerator: ProjectGeneratorProvider;
  interviewAi: InterviewAiProvider;
  researchAi: ResearchAiProvider;
  notesAi: NotesAiProvider;
  assignmentAi: AssignmentAiProvider;
  quizAi: QuizAiProvider;
  flashcardsAi: FlashcardsAiProvider;
  internshipDiscovery: InternshipDiscoveryProvider;
}

export function createStubModuleProviders(): HackathonModuleProviders {
  const nullAsync = async () => null;
  return {
    resumeStudio: { getLatestResumeSummary: nullAsync },
    careerGuidance: { getCareerContext: nullAsync },
    projectGenerator: { getPastProjectsSummary: nullAsync, generateProjectIdea: nullAsync },
    interviewAi: { getReadinessSummary: nullAsync },
    researchAi: { getSummary: nullAsync },
    notesAi: { getSummary: nullAsync },
    assignmentAi: { getSummary: nullAsync },
    quizAi: { getPerformanceSummary: nullAsync },
    flashcardsAi: { getAnalyticsSummary: nullAsync },
    internshipDiscovery: { getContextSummary: nullAsync },
  };
}
