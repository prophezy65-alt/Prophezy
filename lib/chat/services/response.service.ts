/**
 * lib/chat/services/response.service.ts
 *
 * Turns 0+ ModuleResults into the final assistant message. Skips the AI
 * synthesis call entirely for the 0-or-1-module case (nothing to combine —
 * cheaper and faster to just use the single summary or fall through to
 * plain chat.service.ts streaming for open-ended conversation).
 */

import { runStructured } from "../../ai/services/_run-structured";
import { RESPONSE_SYNTHESIS_PROMPT } from "./response-synthesis.prompt";
import type { ChatModuleId, ModuleResult } from "../types/chat.types";

export interface SynthesizedResponse {
  message: string;
  suggestedNextSteps: string[];
  modulesInvoked: ChatModuleId[];
}

export async function synthesizeResponse(params: {
  userId: string;
  userGoalSummary: string;
  results: ModuleResult[];
  notWiredModules: ChatModuleId[];
}): Promise<SynthesizedResponse> {
  const modulesInvoked = params.results.map((r) => r.module);

  if (params.results.length === 0 && params.notWiredModules.length === 0) {
    // Nothing was routed — this is plain conversation, handled by
    // lib/ai/services/chat.service.ts#sendChatMessage directly (streamed),
    // not this synthesis path. Callers should check this case before
    // calling synthesizeResponse at all; this branch exists as a safe
    // fallback rather than a silent no-op.
    return { message: "", suggestedNextSteps: [], modulesInvoked: [] };
  }

  if (params.results.length === 1 && params.notWiredModules.length === 0) {
    const only = params.results[0]!;
    return { message: only.summary, suggestedNextSteps: [], modulesInvoked };
  }

  const synthesized = await runStructured(RESPONSE_SYNTHESIS_PROMPT, {
    userId: params.userId,
    input: {
      userGoalSummary: params.userGoalSummary,
      moduleResults: params.results.map((r) => ({ module: r.module, summary: r.summary })),
      notWiredModules: params.notWiredModules,
    },
  });

  return { message: synthesized.message, suggestedNextSteps: synthesized.suggestedNextSteps, modulesInvoked };
}
