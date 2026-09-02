import type { AIRunner, AIRunOptions } from '../types';
import { GeminiClient } from './gemini.client';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.ai');

/**
 * The engine depends on the `AIRunner` interface, never on a concrete model client.
 *
 * To route every internship AI call through Prophezy's existing AI Core Engine
 * (`lib/ai/engine.ts` — rate limiting, caching, cost analytics, safety), call
 * `setAIRunner()` once at boot, e.g. in `instrumentation.ts`:
 *
 *   import { runAI } from '@/lib/ai/engine';
 *   import { setAIRunner } from '@/lib/internships/ai/engine.adapter';
 *
 *   setAIRunner({
 *     runJson: (system, user, options) =>
 *       runAI({ system, user, jsonMode: true, feature: options.feature, userId: options.userId }),
 *     embed: (input) => embed(input),
 *   });
 *
 * Until then it falls back to a direct Gemini client so the module is standalone-runnable.
 */

class DefaultRunner implements AIRunner {
  private client: GeminiClient | null = null;

  private get gemini(): GeminiClient {
    this.client ??= new GeminiClient();
    return this.client;
  }

  runJson<T>(systemPrompt: string, userPrompt: string, options: AIRunOptions): Promise<T> {
    return this.gemini.generateJson<T>(systemPrompt, userPrompt, options);
  }

  embed(input: string | string[]): Promise<number[][]> {
    return this.gemini.embed(input);
  }
}

let runner: AIRunner = new DefaultRunner();
let injected = false;

export function setAIRunner(next: AIRunner): void {
  runner = next;
  injected = true;
  log.info('AI runner injected — internship AI calls now route through the host engine');
}

export function getAIRunner(): AIRunner {
  return runner;
}

export function isHostEngineBound(): boolean {
  return injected;
}
