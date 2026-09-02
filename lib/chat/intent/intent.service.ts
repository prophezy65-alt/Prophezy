/**
 * lib/chat/intent/intent.service.ts
 *
 * Thin wrapper around INTENT_DETECTION_PROMPT via runStructured — the only
 * place raw AI classification output gets converted into the typed
 * IntentClassification the rest of the orchestrator works with.
 */

import { runStructured } from "../../ai/services/_run-structured";
import { INTENT_DETECTION_PROMPT } from "./intent-detection.prompt";
import type { ChatModuleId, IntentClassification, ModuleIntent } from "../types/chat.types";
import { ALL_CHAT_MODULES } from "../types/chat.types";

const MODULE_SET = new Set<string>(ALL_CHAT_MODULES);

function isValidModule(m: string): m is ChatModuleId {
  return MODULE_SET.has(m);
}

export interface DetectIntentParams {
  userId: string;
  message: string;
  conversationContext: string;
}

export async function detectIntent(params: DetectIntentParams): Promise<IntentClassification> {
  const result = await runStructured(INTENT_DETECTION_PROMPT, {
    userId: params.userId,
    input: { message: params.message, conversationContext: params.conversationContext },
  });

  // Defensive filter: drop any module the model hallucinated outside the
  // enum (jsonMode + responseSchema constrains this, but never trust a
  // model's string output as a type without a runtime check).
  const modules: ModuleIntent[] = result.modules
    .filter((m) => isValidModule(m.module))
    .map((m) => ({ module: m.module as ChatModuleId, confidence: clamp01(m.confidence), reason: m.reason }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    modules,
    entities: result.entities,
    needsClarification: result.needsClarification,
    clarifyingQuestion: result.clarifyingQuestion,
    userGoalSummary: result.userGoalSummary,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Modules above this confidence are acted on without asking; below it, only surfaced if nothing else qualifies. */
export const ACT_CONFIDENCE_THRESHOLD = 0.5;

export function actionableModules(intent: IntentClassification): ModuleIntent[] {
  return intent.modules.filter((m) => m.confidence >= ACT_CONFIDENCE_THRESHOLD);
}
