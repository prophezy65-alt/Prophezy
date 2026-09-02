/**
 * lib/quiz/models/quiz.types.ts
 *
 * Domain types for the Quiz Intelligence Engine. These mirror
 * supabase/migrations/0009_assignments.sql + 0021-0026_quiz_engine_*.sql
 * exactly — field names and nullability match the DB 1:1 so services can
 * pass Supabase rows through without a mapping layer.
 */

// ---- enums (mirror supabase/migrations/0021_quiz_engine_enums.sql) --------

export type QuizQuestionType =
  | "mcq"
  | "true_false"
  | "fill_in_blank"
  | "one_word"
  | "multiple_select"
  | "match_following"
  | "ordering"
  | "short_answer"
  | "long_answer"
  | "essay"
  | "case_study"
  | "programming"
  | "debugging"
  | "sql"
  | "mathematics"
  | "physics"
  | "chemistry"
  | "biology"
  | "engineering"
  | "medical"
  | "law"
  | "business"
  | "ai_ml"
  | "coding_challenge";

export type QuizDifficulty = "easy" | "medium" | "hard" | "expert";

export type QuizExamMode =
  | "practice"
  | "timed_test"
  | "mock_exam"
  | "competitive_exam"
  | "revision_test"
  | "chapter_test"
  | "unit_test"
  | "semester_exam"
  | "final_exam"
  | "custom_exam";

export type QuizAttemptStatus = "in_progress" | "submitted" | "graded" | "abandoned";

export type QuizGradingMethod = "exact_match" | "set_match" | "ai_graded";

/** question_type -> grading_method. Single source of truth, used at question-creation time. */
export const GRADING_METHOD_BY_TYPE: Record<QuizQuestionType, QuizGradingMethod> = {
  mcq: "exact_match",
  true_false: "exact_match",
  fill_in_blank: "exact_match",
  one_word: "exact_match",
  multiple_select: "set_match",
  match_following: "set_match",
  ordering: "set_match",
  short_answer: "ai_graded",
  long_answer: "ai_graded",
  essay: "ai_graded",
  case_study: "ai_graded",
  programming: "ai_graded",
  debugging: "ai_graded",
  sql: "ai_graded",
  mathematics: "ai_graded",
  physics: "ai_graded",
  chemistry: "ai_graded",
  biology: "ai_graded",
  engineering: "ai_graded",
  medical: "ai_graded",
  law: "ai_graded",
  business: "ai_graded",
  ai_ml: "ai_graded",
  coding_challenge: "ai_graded",
};

// ---- Topic ------------------------------------------------------------------

export interface QuizTopic {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  subject: string | null;
  createdAt: string;
}

// ---- Quiz ---------------------------------------------------------------

export interface Quiz {
  id: string;
  generationId: string;
  title: string;
  examMode: QuizExamMode;
  difficulty: QuizDifficulty;
  isAdaptive: boolean;
  timeLimitSec: number | null;
  negativeMarking: number; // fraction deducted per wrong answer, 0 = disabled
  topicIds: string[];
  sourceUploadId: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---- Question payload variants (stored in quiz_questions.metadata) --------

export interface McqOption {
  key: string;
  text: string;
}

export interface MatchFollowingPair {
  left: string;
  right: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}

export type QuestionMetadata =
  | { kind: "match_following"; pairs: MatchFollowingPair[] }
  | { kind: "ordering"; items: string[]; correctOrder: number[] }
  | { kind: "multiple_select"; options: McqOption[]; correctOptions: string[] }
  | {
      kind: "code";
      language: string;
      starterCode?: string;
      testCases: TestCase[];
    }
  | { kind: "subject_response"; modelSolution: string; rubric?: string[] }
  | { kind: "generic"; [key: string]: unknown };

export interface QuizQuestion {
  id: string;
  quizId: string;
  position: number;
  questionText: string;
  questionType: QuizQuestionType;
  gradingMethod: QuizGradingMethod;
  difficulty: QuizDifficulty;
  marks: number;
  options: McqOption[] | null;
  correctOption: string | null;
  hint: string | null;
  explanation: string | null;
  stepSolution: string | null;
  topicId: string | null;
  conceptTags: string[];
  metadata: QuestionMetadata;
  createdAt: string;
}

// ---- Attempt / Response -----------------------------------------------

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  status: QuizAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  timeTakenSec: number | null;
  rawScore: number | null;
  finalScore: number | null;
  maxScore: number;
  accuracyPct: number | null;
  completionPct: number;
  isAdaptiveRun: boolean;
  nextDifficulty: QuizDifficulty | null;
  createdAt: string;
}

/** The shape of QuizResponse.response varies by question type — mirrors the answer shape, not the metadata shape. */
export type ResponsePayload =
  | string // one_word, fill_in_blank, mcq option key, true_false, short/long/essay text, code
  | string[] // multiple_select option keys, ordering (submitted order as item ids)
  | MatchFollowingPair[] // match_following
  | null;

export interface QuizResponse {
  id: string;
  attemptId: string;
  questionId: string;
  response: ResponsePayload;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  aiFeedback: string | null;
  timeSpentSec: number | null;
  hintUsed: boolean;
  answeredAt: string;
}

// ---- Result / Score (computed, not necessarily persisted 1:1) -----------

export interface QuizResult {
  attempt: QuizAttempt;
  responses: QuizResponse[];
  topicBreakdown: TopicPerformance[];
  weakTopics: TopicPerformance[];
  strongTopics: TopicPerformance[];
  revisionSuggestions: string[];
}

export interface TopicPerformance {
  topicId: string;
  topicName: string;
  attempted: number;
  correct: number;
  accuracyPct: number;
  masteryScore: number;
}

// ---- Analytics ------------------------------------------------------------

export interface QuizAnalyticsSnapshot {
  userId: string;
  totalAttempts: number;
  averageScorePct: number;
  completionPct: number;
  averageTimePerQuestionSec: number;
  currentStreak: number;
  longestStreak: number;
  topicMastery: TopicPerformance[];
}

// ---- Leaderboard ------------------------------------------------------

export interface LeaderboardEntry {
  userId: string;
  scope: string; // 'global' | 'subject:<subject>' | 'weekly:<iso_week>'
  subject: string | null;
  score: number;
  attemptsCount: number;
  rank: number; // computed at query time, not stored
}

// ---- Review ------------------------------------------------------------

export interface QuizQuestionReview {
  id: string;
  questionId: string;
  userId: string;
  markedForReview: boolean;
  reportedIssue: string | null;
  createdAt: string;
}
