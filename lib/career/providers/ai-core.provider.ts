/**
 * ai-core.provider.ts
 * The Career Guidance Engine NEVER calls Gemini directly. Every AI request
 * goes through the existing AI Core Engine (owned by another engineer) via
 * this interface. Wire the real implementation in at app bootstrap time
 * (e.g. `lib/ai-core/client.ts`) and inject it into every career service.
 *
 * This file defines the contract only. Do not implement Gemini calls here.
 */

export interface AiCoreTextRequest {
  /** A short machine-readable id for logging/metrics, e.g. "career.skill_gap" */
  taskId: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** When true, AI Core is expected to return valid JSON text. */
  jsonMode?: boolean;
}

export interface AiCoreTextResponse {
  text: string;
  /** Present when the AI Core Engine tracks token usage centrally. */
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Contract the AI Core Engine module must satisfy. The Career Guidance
 * Engine is built entirely against this interface so it compiles and is
 * independently testable even before the real AI Core client is wired in.
 */
export interface AiCoreClient {
  generateText(request: AiCoreTextRequest): Promise<AiCoreTextResponse>;
  generateJson<T>(request: Omit<AiCoreTextRequest, "jsonMode">): Promise<T>;
}

export class AiCoreError extends Error {
  constructor(message: string, public readonly taskId?: string) {
    super(message);
    this.name = "AiCoreError";
  }
}

/**
 * Lightweight in-memory stub so this module compiles and is unit-testable
 * standalone. DO NOT use in production — replace with the real AI Core
 * Engine client via dependency injection (see README "Wiring").
 */
export function createStubAiCoreClient(): AiCoreClient {
  return {
    async generateText(request) {
      throw new AiCoreError(
        `AI Core stub has no implementation for task "${request.taskId}". Inject the real AiCoreClient.`,
        request.taskId
      );
    },
    async generateJson<T>(request: Omit<AiCoreTextRequest, "jsonMode">): Promise<T> {
      throw new AiCoreError(
        `AI Core stub has no implementation for task "${request.taskId}". Inject the real AiCoreClient.`,
        request.taskId
      );
    },
  };
}
