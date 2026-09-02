/**
 * lib/chat/router/module-registry.ts
 *
 * Every module the orchestrator can route to implements the same
 * ModuleAdapter contract, so router.service.ts and planner.service.ts never
 * need a switch statement over module-specific call shapes.
 *
 * Adapters for quiz_ai and interview_ai are REAL — built against the actual
 * lib/quiz/* service code and lib/ai/services/interview.service.ts this
 * project already has. Every other adapter is registered but throws
 * ModuleNotWiredError with the exact missing file, per the same
 * flag-don't-fake pattern used for PDF/DOCX export in the Quiz Engine
 * delivery. Wiring one is: implement the adapter function using that
 * module's real service, then swap the registry entry — nothing else in
 * the orchestrator changes.
 */

import type { ChatModuleId, ModuleInvocationParams, ModuleResult } from "../types/chat.types";
import { ModuleNotWiredError } from "../types/chat.types";

export type ModuleAdapter = (params: ModuleInvocationParams) => Promise<ModuleResult>;

// ---- quiz_ai: real, built against lib/quiz/* from this project's own prior delivery ----

async function quizAdapter(params: ModuleInvocationParams): Promise<ModuleResult> {
  const { generateAndValidateQuiz } = await import("../../quiz/generator/generator.service");
  const { commonEntities } = await import("../entities/entity-normalizer");
  const common = commonEntities(params.entities);

  const { title, validatedQuestions } = await generateAndValidateQuiz({
    userId: params.userId,
    source: { sourceType: "text", text: params.instruction },
    title: common.subject ? `${common.subject} Quiz` : undefined,
    examMode: "practice",
    difficulty: (common.difficulty as any) ?? "medium",
    isAdaptive: false,
    questionTypes: ["mcq", "true_false", "short_answer"],
    questionCount: 10,
    negativeMarking: 0,
    topicIds: [],
  });

  // NOTE: persisting requires a `generations` row id from the existing
  // generation-orchestration flow (see lib/quiz/README.md's "two-step by
  // design" note) — the orchestrator's caller (an API route) is expected to
  // create that row and call persistGeneratedQuiz() itself using this
  // result, same contract the Quiz Engine README documents. Returning the
  // validated-but-unpersisted quiz here keeps this adapter honest about
  // what it actually completed.
  return {
    module: "quiz_ai",
    summary: `Generated a ${validatedQuestions.length}-question quiz${common.subject ? ` on ${common.subject}` : ""}: "${title}". Ready to save once you confirm.`,
    data: { title, questionCount: validatedQuestions.length, validatedQuestions },
  };
}

// ---- interview_ai: real, built against the real interview.service.ts ----

async function interviewAdapter(params: ModuleInvocationParams): Promise<ModuleResult> {
  const { startInterviewSession } = await import("../../ai/services/interview.service");
  const { commonEntities } = await import("../entities/entity-normalizer");
  const common = commonEntities(params.entities);

  if (!common.role) {
    return {
      module: "interview_ai",
      summary: "I can start a mock interview — what role should I interview you for?",
    };
  }

  // Reuses the chat session id as the interview session id: one Redis
  // session per chat conversation, same convention chat.service.ts uses,
  // so the interview's turn history lives in the same place the rest of
  // this conversation's context does.
  await startInterviewSession(params.sessionId, params.userId, {
    role: common.role,
    seniority: (common.seniority as any) ?? "mid",
    style: "mixed",
  });

  return {
    module: "interview_ai",
    summary: `Started a mock interview for a ${common.seniority ?? "mid"}-level ${common.role} role. Send your answer to the first question to continue — responses stream from interview.service.ts#respondToAnswer.`,
    streamSessionId: params.sessionId,
  };
}

// ---- not yet wired: every module without a verified real service file ----

function notWired(module: ChatModuleId, missingFile: string): ModuleAdapter {
  return async () => {
    throw new ModuleNotWiredError(module, missingFile);
  };
}

export const MODULE_REGISTRY: Record<ChatModuleId, ModuleAdapter> = {
  quiz_ai: quizAdapter,
  interview_ai: interviewAdapter,

  resume_studio: notWired("resume_studio", "lib/ai/services/resume.service.ts (signature not yet seen)"),
  research_ai: notWired("research_ai", "lib/ai/services/research.service.ts (signature not yet seen)"),
  project_generator: notWired("project_generator", "lib/ai/services/project.service.ts (signature not yet seen)"),
  syllabus_ai: notWired("syllabus_ai", "the Syllabus AI service file (not yet seen — not in the AI Core README's services/ listing, may live elsewhere)"),
  assignment_ai: notWired("assignment_ai", "lib/ai/services/assignment.service.ts (signature not yet seen)"),
  notes_ai: notWired("notes_ai", "lib/ai/services/notes.service.ts (signature not yet seen)"),
  flashcards_ai: notWired("flashcards_ai", "lib/ai/services/flashcard.service.ts (signature not yet seen)"),
  career_guidance_ai: notWired("career_guidance_ai", "lib/ai/services/career.service.ts (signature not yet seen)"),
  internship_discovery_ai: notWired("internship_discovery_ai", "the Internship Discovery AI service file (not yet seen)"),
  hackathon_ai: notWired("hackathon_ai", "the Hackathon AI service file (not yet seen)"),
  humanizer_ai: notWired("humanizer_ai", "lib/ai/services/humanizer.service.ts (signature not yet seen)"),
  document_intelligence_engine: notWired(
    "document_intelligence_engine",
    "the Document Intelligence Engine service file — note lib/ai/services/ocr.service.ts IS seen and reused directly by lib/quiz's generator, but Document Intelligence Engine as its own module (structure extraction beyond OCR) hasn't been shown"
  ),
};

export function getModuleAdapter(module: ChatModuleId): ModuleAdapter {
  return MODULE_REGISTRY[module];
}

/** Which modules can actually be invoked right now vs. which need their real service file first — surfaced to intent.service.ts / planner.service.ts so they can deprioritize not-yet-wired modules in favor of an honest "I can't do that part yet" instead of a runtime crash mid-plan. */
export const WIRED_MODULES: ChatModuleId[] = ["quiz_ai", "interview_ai"];
