// Matches the `entity_type` check constraint on both `bookmarks` (0015) and
// `content_views` (20260801000000) exactly — keep these in sync if either
// migration's allowed list ever changes.
export type StudyEntityType =
  | "note"
  | "flashcard_deck"
  | "assignment"
  | "quiz"
  | "project"
  | "resume"
  | "research_paper"
  | "trending_research_topic"
  | "internship";

export interface Bookmark {
  id: string;
  userId: string;
  entityType: StudyEntityType;
  entityId: string;
  createdAt: string;
}

export interface ContentView {
  id: string;
  userId: string;
  entityType: StudyEntityType;
  entityId: string;
  viewedAt: string;
}

export interface StudySession {
  id: string;
  userId: string;
  subject: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: string;
}

export interface StudyAnalytics {
  totalSessions: number;
  totalSecondsThisWeek: number;
  totalSecondsAllTime: number;
  currentStreakDays: number;
  longestStreakDays: number;
  dailyBreakdown: { date: string; seconds: number }[];
}

const STUDY_ENTITY_TYPES: readonly StudyEntityType[] = [
  "note",
  "flashcard_deck",
  "assignment",
  "quiz",
  "project",
  "resume",
  "research_paper",
  "trending_research_topic",
  "internship",
];

export function isStudyEntityType(value: string | null): value is StudyEntityType {
  return value !== null && (STUDY_ENTITY_TYPES as readonly string[]).includes(value);
}
