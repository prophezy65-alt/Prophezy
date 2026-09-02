/**
 * lib/hackathons/providers/ai-core.adapter.ts
 *
 * Real implementation of AiCoreClient (providers/ai-core.provider.ts),
 * bridging to the actual AI Core Engine's runAI(). Uses runAI directly
 * rather than runStructured, since AiCoreTextRequest carries a raw prompt
 * string with no fixed PromptDefinition/response schema — every hackathon
 * service that calls generateJson<T> already validates the parsed result
 * against its own zod schema afterward (per this module's own README:
 * "Every AI JSON response is schema-validated before use"), so a generic
 * passthrough here is the correct level, not a shortcut.
 */

import { runAI } from "../../ai/engine";
import { AIValidationError } from "../../ai/utils/errors";
import type { AiCoreClient, AiCoreTextRequest, AiCoreTextResponse } from "./ai-core.provider";
import { AiCoreError } from "./ai-core.provider";

const GENERIC_JSON_SCHEMA = { type: "object" } as const;

export function createRealAiCoreClient(): AiCoreClient {
  return {
    async generateText(request: AiCoreTextRequest): Promise<AiCoreTextResponse> {
      try {
        const result = await runAI({
          feature: `hackathons.${request.taskId}`,
          userId: request.userId ?? "anonymous",
          systemInstruction: "You are a concise, factual assistant for a hackathon discovery product. Follow the user prompt exactly.",
          messages: [{ role: "user", parts: [{ text: request.prompt }] }],
          jsonMode: request.jsonMode,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
        });
        return { text: result.text, usage: { inputTokens: result.usage.promptTokens, outputTokens: result.usage.outputTokens } };
      } catch (error) {
        throw new AiCoreError(error instanceof Error ? error.message : "AI Core request failed.", request.taskId);
      }
    },

    async generateJson<T>(request: Omit<AiCoreTextRequest, "jsonMode">): Promise<T> {
      try {
        const result = await runAI<T>({
          feature: `hackathons.${request.taskId}`,
          userId: request.userId ?? "anonymous",
          systemInstruction:
            "You are a concise, factual assistant for a hackathon discovery product. Respond with strict JSON matching what the prompt asks for — no prose, no markdown fences.",
          messages: [{ role: "user", parts: [{ text: request.prompt }] }],
          jsonMode: true,
          responseSchema: GENERIC_JSON_SCHEMA,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
        });
        if (result.json === null) {
          throw new AIValidationError(`hackathons.${request.taskId}: model returned no parsable JSON.`);
        }
        return result.json;
      } catch (error) {
        throw new AiCoreError(error instanceof Error ? error.message : "AI Core JSON request failed.", request.taskId);
      }
    },
  };
}
