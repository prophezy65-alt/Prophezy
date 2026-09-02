/**
 * lib/chat/types/chat.types.ts
 *
 * Domain types for the AI Chat Assistant / Master Orchestrator. Mirror
 * supabase/migrations/0029-0032_chat_*.sql exactly, same convention as
 * lib/quiz/models/quiz.types.ts (camelCase here, snake_case in the DB,
 * mapped in providers/supabase-chat.provider.ts).
 */

// ---- enums (mirror 0029_chat_enums.sql) ------------------------------

export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatSessionStatus = "active" | "archived";
export type AssistantFeedbackRating = "thumbs_up" | "thumbs_down";

/** The 14 routable modules from the mission spec, 1:1 with public.chat_module. */
export type ChatModuleId =
  | "resume_studio"
  | "research_ai"
  | "project_generator"
  | "syllabus_ai"
  | "assignment_ai"
  | "notes_ai"
  | "flashcards_ai"
  | "quiz_ai"
  | "interview_ai"
  | "career_guidance_ai"
  | "internship_discovery_ai"
  | "hackathon_ai"
  | "humanizer_ai"
  | "document_intelligence_engine";

export const ALL_CHAT_MODULES: ChatModuleId[] = [
  "resume_studio",
  "research_ai",
  "project_generator",
  "syllabus_ai",
  "assignment_ai",
  "notes_ai",
  "flashcards_ai",
  "quiz_ai",
  "interview_ai",
  "career_guidance_ai",
  "internship_discovery_ai",
  "hackathon_ai",
  "humanizer_ai",
  "document_intelligence_engine",
];

// ---- session / message --------------------------------------------------

export interface ChatSessionMetadata {
  /** Set while a multi-step planner.service.ts plan is executing; cleared on completion/cancel. */
  activePlan?: ExecutionPlan;
  /** Set when the assistant needs one more piece of info before it can act (e.g. "which course syllabus?"). */
  pendingClarification?: { question: string; forModule: ChatModuleId };
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  status: ChatSessionStatus;
  lastMessageAt: string;
  metadata: ChatSessionMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  modulesInvoked: ChatModuleId[] | null;
  intent: IntentClassification | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  sessionId: string;
  summaryText: string;
  messageCountCovered: number;
  createdAt: string;
}

export interface AssistantFeedback {
  id: string;
  messageId: string;
  userId: string;
  rating: AssistantFeedbackRating;
  comment: string | null;
  createdAt: string;
}

// ---- intent / entities -----------------------------------------------

export interface ExtractedEntities {
  /** Free-form key -> value, e.g. { "subject": "Thermodynamics", "deadline": "tomorrow", "role": "SDE Intern" } */
  [key: string]: string | string[] | undefined;
}

export interface ModuleIntent {
  module: ChatModuleId;
  confidence: number; // 0-1
  reason: string; // short, human-readable justification, shown in analytics/debugging
}

export interface IntentClassification {
  /** Modules to invoke, ordered by relevance — may be empty if this is plain conversation with no module needed. */
  modules: ModuleIntent[];
  entities: ExtractedEntities;
  /** True when confidence on every candidate module is too low to act without asking the user first. */
  needsClarification: boolean;
  clarifyingQuestion: string | null;
  /** Short restatement of what the user is trying to accomplish, used by planner.service.ts and response.service.ts. */
  userGoalSummary: string;
}

// ---- planning ---------------------------------------------------------

export interface PlanStep {
  id: string;
  module: ChatModuleId;
  /** Human-readable description of what this step does, shown to the user as progress ("Generating flashcards..."). */
  description: string;
  /** Step ids that must complete before this one starts. Empty = can run immediately/in parallel with other roots. */
  dependsOn: string[];
  /** Free-form params passed to the module adapter; shape is module-specific, validated by that adapter. */
  params: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: ModuleResult;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  sessionId: string;
  steps: PlanStep[];
  createdAt: string;
}

// ---- module adapter contract (router/module-registry.ts) -----------------

export interface ModuleInvocationParams {
  userId: string;
  sessionId: string;
  /** The specific ask for this module, derived from the user's message + extracted entities — not the whole raw message. */
  instruction: string;
  entities: ExtractedEntities;
  /** Outputs of prior plan steps this step depends on, keyed by step id — lets e.g. quiz_ai consume notes_ai's output. */
  upstreamResults?: Record<string, ModuleResult>;
}

export interface ModuleResult {
  module: ChatModuleId;
  summary: string; // short natural-language result, folded into the synthesized response
  data?: unknown; // structured payload (e.g. the created Quiz), for the frontend to deep-link to
  /** Set when the module streams its own response (e.g. interview_ai) rather than returning a summary synchronously. */
  streamSessionId?: string;
}

export class ModuleNotWiredError extends Error {
  constructor(module: ChatModuleId, missingFile: string) {
    super(
      `Module "${module}" is not yet wired into the orchestrator — its adapter needs the real ` +
        `service file/signature at ${missingFile} before this can call it for real. See router/module-registry.ts.`
    );
    this.name = "ModuleNotWiredError";
  }
}
