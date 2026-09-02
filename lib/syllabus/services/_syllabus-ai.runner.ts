/**
 * lib/syllabus/services/_syllabus-ai.runner.ts
 *
 * Thin wrapper over the shared AI-Core structured runner. Every
 * "generate X from the syllabus" feature routes through here so it
 * inherits the engine's caching / rate-limiting / analytics
 * middleware. `feature` now lives on each PromptDefinition, and the
 * caller supplies the auth-scoped `userId` the engine meters against.
 */

import { runStructured } from '@/lib/ai/services/_run-structured';
import type { PromptDefinition } from '@/lib/ai/prompts/_shared';

export async function runSyllabusPrompt<TInput, TOutput>(
  prompt: PromptDefinition<TInput, TOutput>,
  input: TInput,
  opts: { userId: string; forceRefresh?: boolean; requestId?: string },
): Promise<TOutput> {
  return runStructured(prompt, {
    userId: opts.userId,
    input,
    forceRefresh: opts.forceRefresh,
    requestId: opts.requestId,
  });
}
