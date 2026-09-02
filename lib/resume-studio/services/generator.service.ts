/**
 * generator.service.ts
 * Single entry point for all Gemini-powered text generation tasks
 * (summary rewrite, bullet rewrite, achievement generation, etc).
 * Higher-level services (optimizer, humanizer, coverletter, linkedin,
 * github, portfolio) call this rather than hitting Gemini directly, so
 * prompt-building and error handling stay consistent.
 */

import {
  AiGenerationRequest,
  AiGenerationResult,
  ServiceResult,
  success,
  failure,
} from "../models/resume.model";
import { aiGenerationRequestSchema, validate } from "../validation/resume.validation";
import { callGemini, GeminiClientError } from "./ai/gemini.client";
import { buildPrompt } from "./ai/ai-prompts";

/**
 * Runs a single AI generation task and returns the generated text.
 * Also requests 2 short alternatives for tasks where variety helps
 * (summary, achievement, cover-letter-adjacent tasks).
 */
export async function generateContent(
  request: AiGenerationRequest
): Promise<ServiceResult<AiGenerationResult>> {
  const validation = validate(aiGenerationRequestSchema, request);
  if (!validation.success) {
    return failure(
      "VALIDATION_ERROR",
      "Invalid AI generation request.",
      validation.errors
    );
  }

  const prompt = buildPrompt(validation.data);

  try {
    const output = await callGemini(prompt, { temperature: 0.7, maxOutputTokens: 512 });

    let alternatives: string[] | undefined;
    if (["improve_summary", "generate_achievement", "rewrite_experience"].includes(request.task)) {
      try {
        const altPrompt = `${prompt}\n\nProvide a different phrasing/angle than a typical first attempt.`;
        const altOutput = await callGemini(altPrompt, { temperature: 0.9, maxOutputTokens: 512 });
        alternatives = [altOutput];
      } catch {
        // alternatives are a nice-to-have; ignore failures silently
      }
    }

    return success<AiGenerationResult>({
      task: request.task,
      output,
      alternatives,
    });
  } catch (err) {
    if (err instanceof GeminiClientError) {
      return failure("AI_GENERATION_FAILED", err.message);
    }
    return failure("AI_GENERATION_FAILED", "Unexpected error generating content.");
  }
}

/**
 * Batch variant — runs multiple generation requests concurrently with a
 * concurrency cap to avoid hammering the free-tier Gemini rate limit.
 */
export async function generateContentBatch(
  requests: AiGenerationRequest[],
  concurrency = 3
): Promise<ServiceResult<AiGenerationResult>[]> {
  const results: ServiceResult<AiGenerationResult>[] = new Array(requests.length);
  let cursor = 0;

  async function worker() {
    while (cursor < requests.length) {
      const index = cursor++;
      results[index] = await generateContent(requests[index]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, requests.length) }, worker);
  await Promise.all(workers);

  return results;
}
