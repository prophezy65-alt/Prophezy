/**
 * lib/chat/orchestrator/orchestrator.service.ts
 *
 * THE entry point for the AI Chat Assistant ("Prophezy AI") — API routes
 * call handleUserMessage() and nothing else in this module directly. Full
 * flow:
 *
 *   1. ensure session exists (Postgres + Redis, via memory.service.ts)
 *   2. record the user's message
 *   3. get conversation context (memory.service.ts, reuses context-manager.ts)
 *   4. detect intent (intent.service.ts)
 *   5a. no modules needed -> return a signal to stream via chat.service.ts directly
 *   5b. modules needed but low confidence -> ask a clarifying question, no module calls
 *   5c. modules needed, confident -> build + execute a plan (planner + router services)
 *   6. synthesize the final response (response.service.ts)
 *   7. record the assistant's message
 *
 * Multi-step execution respects plan dependencies (planner.service.ts) but
 * runs same-tier steps concurrently, not one-at-a-time, since e.g.
 * career_guidance_ai and resume_studio for "I need an internship" don't
 * depend on each other.
 *
 * CREDIT GATING (Phase 4): the whole call is wrapped as ONE
 * PROPHEZY_AI_QUESTION charge (1 credit) — this covers the intent-detection
 * Gemini call that runs on every invocation regardless of outcome.
 *
 * IMPORTANT — compounding charges are intentional, not a bug: if intent
 * detection decides a module is needed (e.g. resume_studio, career_guidance_ai),
 * executePlan() below calls invokeModule(), which calls straight through to
 * the SAME underlying feature functions wired directly to credits in Phase 4
 * (buildResume -> RESUME_AI_ANALYSIS 5 credits, getCareerAdvice ->
 * CAREER_GUIDANCE_AI 2 credits, etc). Those charge independently, on top of
 * this file's 1-credit charge — a single "help me with my resume" question
 * that triggers resume_studio costs 1 + 5 = 6 credits total, because it
 * genuinely triggered two separate real Gemini calls (intent detection +
 * resume generation). This is deliberate: every real AI call goes through
 * the SAME central credit system exactly once, at its own true call site —
 * no feature is charged twice for the same call, and no call goes
 * unaccounted for just because it happened via orchestration instead of a
 * direct feature page.
 */

import * as memory from "../memory/memory.service";
import * as context from "../context/context.service";
import { detectIntent, actionableModules } from "../intent/intent.service";
import { buildExecutionPlan, readySteps, isPlanComplete } from "../planner/planner.service";
import { invokeModule, isModuleWired } from "../router/router.service";
import { synthesizeResponse } from "../services/response.service";
import type { ChatModuleId, IntentClassification, ModuleResult, PlanStep } from "../types/chat.types";
import { spendCreditsForFeature, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";

export type OrchestratorOutcome =
  | { kind: "plain_chat"; contextText: string } // caller should stream via lib/ai/services/chat.service.ts#sendChatMessage
  | { kind: "clarification_needed"; question: string }
  | { kind: "modules_executed"; message: string; suggestedNextSteps: string[]; modulesInvoked: ChatModuleId[] };

export interface HandleUserMessageParams {
  sessionId: string;
  userId: string;
  message: string;
}

export async function handleUserMessage(params: HandleUserMessageParams): Promise<OrchestratorOutcome> {
  const feature = CREDIT_FEATURES.PROPHEZY_AI_QUESTION;
  const cost = await getFeatureCreditCost(feature);
  if (!cost) {
    throw new Error(`Prophezy AI is temporarily unavailable (no active credit cost configured for "${feature}").`);
  }

  return spendCreditsForFeature(
    params.userId,
    cost.creditCost,
    feature,
    () => handleUserMessageImpl(params),
    "Prophezy AI question"
  );
}

async function handleUserMessageImpl(params: HandleUserMessageParams): Promise<OrchestratorOutcome> {
  await memory.ensureSession(params.sessionId, params.userId);

  const pending = await context.getPendingClarification(params.sessionId);
  const { contextText } = await memory.getContextForTurn(params.sessionId, params.userId);

  const intent = await detectIntent({
    userId: params.userId,
    message: params.message,
    conversationContext: pending ? `${contextText}\n\n[Waiting on: ${pending.question}]` : contextText,
  });

  await memory.recordUserMessage(params.sessionId, params.message, intent);

  if (intent.modules.length === 0) {
    await context.setPendingClarification(params.sessionId, null);
    return { kind: "plain_chat", contextText };
  }

  if (intent.needsClarification || actionableModules(intent).length === 0) {
    const question = intent.clarifyingQuestion ?? "Could you tell me a bit more about what you'd like help with?";
    await context.setPendingClarification(params.sessionId, { question, forModule: intent.modules[0]!.module });
    await memory.recordAssistantMessage(params.sessionId, question, []);
    await memory.syncTurnToWorkingMemory(params.sessionId, params.userId, params.message, question);
    return { kind: "clarification_needed", question };
  }

  await context.setPendingClarification(params.sessionId, null);

  const outcome = await executePlan(params.sessionId, params.userId, intent);
  await memory.recordAssistantMessage(params.sessionId, outcome.message, outcome.modulesInvoked);
  await memory.syncTurnToWorkingMemory(params.sessionId, params.userId, params.message, outcome.message);
  return { kind: "modules_executed", ...outcome };
}

async function executePlan(
  sessionId: string,
  userId: string,
  intent: IntentClassification
): Promise<{ message: string; suggestedNextSteps: string[]; modulesInvoked: ChatModuleId[] }> {
  const plan = buildExecutionPlan(sessionId, intent);
  await context.setActivePlan(sessionId, plan);

  const results: ModuleResult[] = [];
  const notWired: ChatModuleId[] = [];
  const upstreamResults: Record<string, ModuleResult> = {};

  while (!isPlanComplete(plan)) {
    const ready = readySteps(plan);
    if (ready.length === 0) break; // safety valve against a dependency cycle — shouldn't happen given DEPENDENCY_HINTS is acyclic by construction, but never spin forever

    for (const step of ready) step.status = "running";

    const settled = await Promise.allSettled(
      ready.map((step) =>
        invokeModule(step.module, {
          userId,
          sessionId,
          instruction: buildStepInstruction(step, intent),
          entities: intent.entities,
          upstreamResults,
        })
      )
    );

    settled.forEach((outcome, i) => {
      const step = ready[i]!;
      if (outcome.status === "fulfilled") {
        step.status = "completed";
        step.result = outcome.value;
        upstreamResults[step.id] = outcome.value;
        results.push(outcome.value);
        if (!isModuleWired(step.module)) notWired.push(step.module);
      } else {
        step.status = "failed";
        step.error = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      }
    });
  }

  await context.setActivePlan(sessionId, null);

  const synthesized = await synthesizeResponse({
    userId,
    userGoalSummary: intent.userGoalSummary,
    results,
    notWiredModules: [...new Set(notWired)],
  });

  return synthesized;
}

function buildStepInstruction(step: PlanStep, intent: IntentClassification): string {
  return `${intent.userGoalSummary} (focus: ${step.description})`;
}
