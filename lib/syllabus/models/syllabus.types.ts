/**
 * lib/syllabus/models/syllabus.types.ts
 *
 * Canonical types for the Syllabus AI module. `ExtractedSyllabus` is
 * the structured record every uploaded syllabus is normalized into;
 * every feature (roadmap, planner, notes, flashcards, quiz, paper
 * predictor, PYQ mapper, revision, doubts, progress, analytics)
 * consumes `ExtractedSyllabus` and produces its own typed output
 * below. Nothing in this module invents a shape at call time —
 * every AI response is validated against one of these.
 */

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

export type SyllabusSourceFormat = 'pdf' | 'docx' | 'image' | 'text';

export interface SyllabusIngestionInput {
  format: SyllabusSourceFormat;
  /** Raw file bytes for pdf/docx/image; the string itself for `text`. */
  content: Buffer | string;
  fileName?: string;
  mimeType?: string;
}

export interface IngestedSyllabusText {
  rawText: string;
  format: SyllabusSourceFormat;
  usedOcr: boolean;
  ocrConfidence?: number;
  pageCount?: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Extracted structured syllabus
// ---------------------------------------------------------------------------

export interface SyllabusUnit {
  unitNumber: number;
  title: string;
  topics: string[];
  hours?: number;
  weightagePercent?: number;
}

export interface SyllabusChapter {
  chapterNumber: number;
  title: string;
  topics: string[];
  unitNumber?: number;
}

export interface PracticalItem {
  title: string;
  description?: string;
  labHours?: number;
}

export interface MarksDistributionItem {
  component: string; // e.g. "Mid-Sem", "End-Sem", "Internal Assessment", "Practical"
  marks: number;
  weightagePercent?: number;
}

export interface ReferenceItem {
  title: string;
  author?: string;
  edition?: string;
  type?: 'textbook' | 'reference' | 'online' | 'other';
}

export interface LearningOutcome {
  code?: string; // e.g. "CO1"
  description: string;
}

export interface ExtractedSyllabus {
  id: string;
  subjectName: string;
  courseCode?: string;
  university?: string;
  semester?: string;
  credits?: number;
  units: SyllabusUnit[];
  chapters: SyllabusChapter[];
  practicals: PracticalItem[];
  labWork: PracticalItem[];
  marksDistribution: MarksDistributionItem[];
  references: ReferenceItem[];
  learningOutcomes: LearningOutcome[];
  extractionWarnings: string[];
  extractedAt: string; // ISO timestamp
  sourceFormat: SyllabusSourceFormat;
}

// ---------------------------------------------------------------------------
// 1. Smart Roadmap
// ---------------------------------------------------------------------------

export type TopicPriority = 'critical' | 'high' | 'medium' | 'low';
export type TopicDifficulty = 'easy' | 'moderate' | 'hard';

export interface RoadmapTopicEntry {
  topic: string;
  unitNumber?: number;
  difficulty: TopicDifficulty;
  priority: TopicPriority;
  estimatedHours: number;
  reason: string;
}

export interface RoadmapDayPlan {
  dayIndex: number; // 0-based, relative to plan start
  date?: string; // ISO date, if examDate was supplied
  topics: string[];
  estimatedHours: number;
  isRevisionDay: boolean;
}

export interface RoadmapWeekPlan {
  weekIndex: number;
  focusTopics: string[];
  goals: string[];
}

export interface RoadmapMonthPlan {
  monthIndex: number;
  milestones: string[];
}

export interface SmartRoadmap {
  syllabusId: string;
  generatedAt: string;
  examDate?: string;
  totalDays: number;
  prioritizedTopics: RoadmapTopicEntry[];
  dailyPlan: RoadmapDayPlan[];
  weeklyPlan: RoadmapWeekPlan[];
  monthlyPlan: RoadmapMonthPlan[];
  revisionPlanDays: number[]; // dayIndex values reserved for revision
  examCountdown: {
    daysRemaining: number;
    riskLevel: 'safe' | 'tight' | 'critical';
    message: string;
  };
}

// ---------------------------------------------------------------------------
// 2. Study Planner
// ---------------------------------------------------------------------------

export interface StudyPlannerInput {
  syllabusId: string;
  examDate: string; // ISO date
  hoursAvailablePerDay: number;
  completedTopics?: string[];
  weakTopics?: string[];
  strongTopics?: string[];
  missedDays?: number[]; // dayIndex values from a prior plan that were skipped
}

export interface AdaptiveStudyPlan {
  syllabusId: string;
  generatedAt: string;
  remainingDays: number;
  totalHoursRequired: number;
  hoursPerDay: number;
  weakTopicAllocation: { topic: string; hoursAllocated: number }[];
  strongTopicAllocation: { topic: string; hoursAllocated: number }[];
  recoveryPlan: {
    missedDays: number[];
    redistributedTopics: string[];
    note: string;
  };
  dailyPlan: RoadmapDayPlan[];
}

// ---------------------------------------------------------------------------
// 3. AI Notes
// ---------------------------------------------------------------------------

export type NotesVariant =
  | 'complete'
  | 'short'
  | 'exam'
  | 'revision'
  | 'one_page'
  | 'mind_map';

export interface MindMapNode {
  label: string;
  children: MindMapNode[];
}

export interface NotesResult {
  syllabusId: string;
  topic: string;
  variant: NotesVariant;
  content: string; // markdown for all variants except mind_map
  mindMap?: MindMapNode;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 4. Flashcards
// ---------------------------------------------------------------------------

export interface Flashcard {
  id: string;
  topic: string;
  front: string;
  back: string;
  difficulty: TopicDifficulty;
  // Spaced-repetition (SM-2 style) metadata — initialized on generation,
  // updated by the client/DB as the user reviews cards.
  srs: {
    intervalDays: number;
    easeFactor: number;
    repetitions: number;
    dueDate: string; // ISO date
  };
}

export interface FlashcardSet {
  syllabusId: string;
  topic: string;
  cards: Flashcard[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 5. Quiz Generator
// ---------------------------------------------------------------------------

export type QuestionType =
  | 'mcq'
  | 'true_false'
  | 'fill_blank'
  | 'short_answer'
  | 'long_answer'
  | 'case_based'
  | 'programming'
  | 'numerical';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // mcq / true_false
  correctAnswer: string;
  explanation: string;
  marks: number;
  difficulty: TopicDifficulty;
  topic: string;
}

export interface QuizSet {
  syllabusId: string;
  topics: string[];
  questions: QuizQuestion[];
  totalMarks: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 6. Previous Paper Predictor
// ---------------------------------------------------------------------------

export interface PredictedTopic {
  topic: string;
  probabilityScore: number; // 0-100
  predictedMarks: number;
  reason: string;
}

export interface PredictedQuestion {
  question: string;
  topic: string;
  probabilityScore: number;
  expectedMarks: number;
  type: QuestionType;
}

export interface PaperPrediction {
  syllabusId: string;
  mostImportantTopics: PredictedTopic[];
  expectedQuestions: PredictedQuestion[];
  overallMarksDistributionForecast: MarksDistributionItem[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 7. PYQ Mapper
// ---------------------------------------------------------------------------

export type CoverageStatus = 'covered' | 'partially_covered' | 'not_covered';

export interface PyqMappingEntry {
  syllabusTopic: string;
  matchedQuestions: string[];
  coverageStatus: CoverageStatus;
  notes: string;
}

export interface PyqMapResult {
  syllabusId: string;
  entries: PyqMappingEntry[];
  coverageSummary: {
    coveredCount: number;
    partialCount: number;
    notCoveredCount: number;
    coveragePercent: number;
  };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 8. AI Revision Mode
// ---------------------------------------------------------------------------

export type RevisionMode = 'last_day' | 'night_before' | 'thirty_min' | 'five_min' | 'formula_sheet';

export interface RevisionPack {
  syllabusId: string;
  mode: RevisionMode;
  content: string; // markdown
  keyFormulas?: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 9. Doubt Generator
// ---------------------------------------------------------------------------

export type DoubtCategory = 'viva' | 'interview' | 'lab' | 'concept';

export interface GeneratedDoubt {
  id: string;
  category: DoubtCategory;
  question: string;
  expectedAnswerPoints: string[];
  topic: string;
  difficulty: TopicDifficulty;
}

export interface DoubtSet {
  syllabusId: string;
  doubts: GeneratedDoubt[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 10. Progress Tracker (deterministic — no AI call)
// ---------------------------------------------------------------------------

export interface TopicProgressInput {
  topic: string;
  completed: boolean;
  revisedCount: number;
  selfRatedConfidence?: number; // 0-100, user-supplied
  quizAccuracyPercent?: number; // 0-100, computed from quiz history
}

export interface ProgressSnapshot {
  syllabusId: string;
  computedAt: string;
  completionPercent: number;
  revisionPercent: number;
  confidencePercent: number;
  masteryPercent: number;
  estimatedExamReadiness: {
    score: number; // 0-100
    band: 'not_ready' | 'needs_work' | 'on_track' | 'exam_ready';
  };
  perTopic: (TopicProgressInput & { masteryScore: number })[];
}

// ---------------------------------------------------------------------------
// 11. Smart Analytics
// ---------------------------------------------------------------------------

export interface ChapterAnalyticsEntry {
  chapterOrUnit: string;
  hardnessScore: number; // 0-100
  lengthScore: number; // 0-100, relative to other chapters
  importanceScore: number; // 0-100
  scoringPotential: number; // 0-100
  frequencyAskedScore: number; // 0-100, from historical exam pattern
}

export interface SmartAnalytics {
  syllabusId: string;
  entries: ChapterAnalyticsEntry[];
  hardestChapters: string[];
  longestChapters: string[];
  mostImportantChapters: string[];
  mostScoringChapters: string[];
  mostAskedChapters: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 12. Export
// ---------------------------------------------------------------------------

export type ExportFormat = 'markdown' | 'pdf' | 'docx' | 'json' | 'csv';

export type ExportableResource =
  | { kind: 'syllabus'; data: ExtractedSyllabus }
  | { kind: 'roadmap'; data: SmartRoadmap }
  | { kind: 'study_plan'; data: AdaptiveStudyPlan }
  | { kind: 'notes'; data: NotesResult }
  | { kind: 'flashcards'; data: FlashcardSet }
  | { kind: 'quiz'; data: QuizSet }
  | { kind: 'paper_prediction'; data: PaperPrediction }
  | { kind: 'pyq_map'; data: PyqMapResult }
  | { kind: 'revision_pack'; data: RevisionPack }
  | { kind: 'doubts'; data: DoubtSet }
  | { kind: 'progress'; data: ProgressSnapshot }
  | { kind: 'analytics'; data: SmartAnalytics };

export interface ExportResult {
  format: ExportFormat;
  fileName: string;
  mimeType: string;
  content: Buffer | string;
}
