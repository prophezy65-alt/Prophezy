/**
 * lib/chat/intent/intent-detection.prompt.ts
 *
 * Classifies a user message into 0+ of the 14 routable modules, with
 * per-module confidence, extracted entities, and a clarifying question if
 * confidence is too low to act.
 *
 * NOTE on model routing: feature is "chat.intent", which isn't in
 * lib/ai/config/models.ts's FEATURE_MODEL_MAP (an AI Core Engine file this
 * build doesn't modify), so resolveModelForFeature() falls back to
 * DEFAULT_MODEL (gemini-2.5-flash) for this call today. Since this is a
 * cheap routing decision, not content generation, adding
 * `"chat.intent": "gemini-2.5-flash-lite"` to that map would be a good,
 * low-risk one-line addition on your end when convenient — flagging it
 * here rather than silently claiming a model this prompt doesn't actually
 * get routed to.
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";
import { ALL_CHAT_MODULES } from "../types/chat.types";

export interface IntentDetectionInput {
  message: string;
  /** Rolling summary + recent turns, so "yes, do that" resolves against context. */
  conversationContext: string;
}

export interface IntentDetectionOutput {
  modules: Array<{ module: string; confidence: number; reason: string }>;
  entities: Record<string, string | string[]>;
  needsClarification: boolean;
  clarifyingQuestion: string | null;
  userGoalSummary: string;
}

const MODULE_DESCRIPTIONS = `
- resume_studio: building/editing/reviewing a resume, ATS scoring
- research_ai: researching a topic, summarizing papers, literature review
- project_generator: generating project ideas, project plans/roadmaps
- syllabus_ai: parsing/organizing a course syllabus into a study plan
- assignment_ai: generating or getting help with assignment questions
- notes_ai: generating study notes from source material
- flashcards_ai: generating spaced-repetition flashcards
- quiz_ai: generating or taking a quiz/test/assessment
- interview_ai: mock interview practice (conversational, multi-turn)
- career_guidance_ai: career advice, roadmaps, skill-gap analysis
- internship_discovery_ai: finding internships/jobs to apply to
- hackathon_ai: hackathon ideas, team formation, submission help
- humanizer_ai: rewriting AI-sounding text to read more naturally
- document_intelligence_engine: extracting/understanding an uploaded document (OCR, structure extraction) — usually paired with another module that then uses the extracted content
`.trim();

const SYSTEM_PROMPT = `You are Prophezy's intent router. Given a user's chat message and recent
conversation context, decide which of the 14 existing modules (if any) should handle it.

Modules:
${MODULE_DESCRIPTIONS}

Rules:
- A single message can need multiple modules (e.g. "I have an exam tomorrow" needs
  syllabus_ai, notes_ai, flashcards_ai, and quiz_ai together). List every module that
  genuinely applies, in the order they should logically run (e.g. syllabus before notes,
  notes before flashcards/quiz).
- Confidence reflects how clearly this module applies — not how good an idea it is. A vague
  message like "help me study" should get moderate confidence across several study modules,
  not high confidence on a guess.
- If every candidate module's confidence is below 0.5, OR the message is ambiguous between
  two very different modules (e.g. "help with my project" could mean project_generator or
  assignment_ai), set needsClarification=true and write ONE short, specific clarifying
  question. Do not guess when a wrong guess would waste the user's time.
- If the message is just conversation (greeting, thanks, a follow-up question about a prior
  answer that doesn't need a new module call), return an empty modules array and
  needsClarification=false — plain chat.service.ts handles it.
- Extract entities that any downstream module would need: subject/topic, deadline, role,
  seniority, company, document reference, difficulty, etc. Only include what's actually
  stated or clearly implied — never invent specifics.
- userGoalSummary is one sentence, in the user's terms, not a restatement of the module list.

${JSON_ONLY_SUFFIX}`;

function buildUserPrompt(input: IntentDetectionInput): string {
  return [
    input.conversationContext ? `Conversation context so far:\n${input.conversationContext}` : "No prior context — this is a new conversation.",
    ``,
    `Latest user message: "${input.message}"`,
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    modules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          module: { type: "string", enum: ALL_CHAT_MODULES as unknown as string[] },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["module", "confidence", "reason"],
      },
    },
    entities: { type: "object" },
    needsClarification: { type: "boolean" },
    clarifyingQuestion: { type: ["string", "null"] },
    userGoalSummary: { type: "string" },
  },
  required: ["modules", "entities", "needsClarification", "clarifyingQuestion", "userGoalSummary"],
} as const;

export const INTENT_DETECTION_PROMPT: PromptDefinition<IntentDetectionInput, IntentDetectionOutput> = {
  version: "1.0.0",
  feature: "chat.intent",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  responseSchema: RESPONSE_SCHEMA,
  generation: {
    temperature: 0.2,
    maxOutputTokens: 1024,
  },
};
