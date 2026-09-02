/**
 * ai-core.provider.ts
 * The Hackathon Intelligence Engine NEVER calls Gemini directly. Every AI
 * request goes through the existing AI Core Engine via this interface.
 * Wire the real implementation in at app bootstrap and inject it into
 * every hackathon service.
 */

export interface AiCoreTextRequest {
  taskId: string;
  /**
   * Passed through to the real AI Core Engine's per-user rate limiting
   * (lib/ai/middleware/rate-limit.ts) when provided. Optional because
   * several hackathon services (AnalysisService/IdeaService/
   * DocumentationService/PlannerService) call generateJson without a user
   * in scope and aren't wired to the real client in this pass (see
   * providers/module-composition.ts) — but any NEW real integration
   * should pass it. The real adapter (ai-core.adapter.ts) falls back to
   * "anonymous" when omitted, same convention documented in the AI Core
   * Engine itself for public/demo-only call paths.
   */
  userId?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

export interface AiCoreTextResponse {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

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
 * Compile-time/testing stub. Replace with the real AI Core Engine client
 * via dependency injection — see README "Wiring".
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
