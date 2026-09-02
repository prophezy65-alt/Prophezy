/**
 * api.ts (Study Hub)
 *
 * Typed interfaces for topic-driven generation. NONE of these are wired to
 * real backend endpoints yet — this file exists so the UI has a single,
 * typed seam to plug real calls into once the actual route contracts for
 * notes/quiz/flashcards/etc. generation are confirmed (this repo's live
 * API surface has diverged from what's visible in this environment).
 *
 * Every function here deliberately throws NotConnectedError rather than
 * returning fabricated data — the UI is expected to catch that and render
 * an honest "not connected yet" state, never a fake result.
 *
 * TODO: once real route paths/payloads are confirmed, replace each
 * function body with an actual fetch() call, matching the pattern used in
 * components/dashboard/career/CareerGuidanceClient.tsx (apiRequest helper,
 * ApiEnvelope<T> response shape).
 */

export class NotConnectedError extends Error {
  constructor(feature: string) {
    super(`${feature} isn't connected to a backend yet.`);
    this.name = "NotConnectedError";
  }
}

export type StudyArtifactKind =
  | "roadmap"
  | "notes"
  | "flashcards"
  | "quiz"
  | "interviewQuestions"
  | "assignments"
  | "projects"
  | "resumeSkills"
  | "researchPapers"
  | "githubIdeas"
  | "resources"
  | "dailyPlan";

export interface GenerateArtifactRequest {
  topic: string;
  kind: StudyArtifactKind;
}

/** TODO: wire to the real per-kind generation endpoint once confirmed. */
export async function generateArtifact(_request: GenerateArtifactRequest): Promise<never> {
  throw new NotConnectedError("Generation");
}

export interface UploadStudyFileRequest {
  file: File;
}

/** TODO: wire to a real upload-ingestion endpoint (uploads table exists; no generic creation route was found to reuse safely). */
export async function uploadStudyFile(_request: UploadStudyFileRequest): Promise<never> {
  throw new NotConnectedError("File upload");
}

export interface CopilotMessageRequest {
  message: string;
  topic?: string;
}

/** TODO: wire to a real Study Hub copilot endpoint (lib/chat exists but isn't wired to any UI yet). */
export async function askCopilot(_request: CopilotMessageRequest): Promise<never> {
  throw new NotConnectedError("AI Copilot");
}

export interface LearningStats {
  studyStreakDays: number | null;
  todaysStudyMinutes: number | null;
  weakTopics: string[] | null;
  strongTopics: string[] | null;
  recentlyStudied: { topic: string; lastOpenedAt: string }[] | null;
}

/** TODO: no streak/goal/weak-topic tracking tables exist yet — wire once that schema exists. */
export async function getLearningStats(): Promise<never> {
  throw new NotConnectedError("Learning stats");
}
