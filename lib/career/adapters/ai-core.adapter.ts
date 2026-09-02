/**
 * ai-core.adapter.ts
 *
 * Real implementation of `AiCoreClient` (lib/career/providers/ai-core.provider.ts)
 * backed by the existing AI Core Engine (lib/ai/engine.ts -> Gemini). This is
 * the only file in the Career Guidance module that imports the AI engine —
 * every career service still only depends on the `AiCoreClient` interface.
 */

import { runAI } from "@/lib/ai/engine";
import {
  AiCoreClient,
  AiCoreError,
  AiCoreTextRequest,
  AiCoreTextResponse,
} from "../providers/ai-core.provider";

/**
 * Builds an AiCoreClient bound to a specific user, since the underlying AI
 * Core Engine requires a userId for rate limiting and usage analytics.
 * Create one per request (per authenticated user) rather than sharing a
 * single instance across users.
 */
export function createAiCoreClient(userId: string): AiCoreClient {
  return {
    async generateText(request: AiCoreTextRequest): Promise<AiCoreTextResponse> {
      try {
        const result = await runAI({
          feature: request.taskId,
          userId,
          systemInstruction:
            "You are Prophezy's AI Career Guidance advisor. Follow the instructions in the user prompt exactly.",
          messages: [{ role: "user", parts: [{ text: request.prompt }] }],
          jsonMode: request.jsonMode,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
        });

        return {
          text: result.text,
          usage: {
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.outputTokens,
          },
        };
      } catch (error) {
        throw new AiCoreError((error as Error).message, request.taskId);
      }
    },

    async generateJson<T>(request: Omit<AiCoreTextRequest, "jsonMode">): Promise<T> {
      try {
        const result = await runAI<T>({
          feature: request.taskId,
          userId,
          systemInstruction:
            "You are Prophezy's AI Career Guidance advisor. Return ONLY valid JSON matching the shape described in the prompt — no markdown fences, no commentary.",
          messages: [{ role: "user", parts: [{ text: request.prompt }] }],
          jsonMode: true,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
        });

        if (result.json === null) {
          throw new AiCoreError("AI Core did not return parseable JSON.", request.taskId);
        }
        return result.json;
      } catch (error) {
        if (error instanceof AiCoreError) throw error;
        throw new AiCoreError((error as Error).message, request.taskId);
      }
    },
  };
}
