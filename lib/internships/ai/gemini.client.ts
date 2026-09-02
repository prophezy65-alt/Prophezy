import { getEnv } from '../config/env';
import { EngineError, ProviderUnconfiguredError } from '../utils/errors';
import { httpRequest } from '../utils/http';
import { EMBEDDING_DIMENSIONS } from '../config/constants';
import type { AIRunOptions } from '../types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart { text?: string }
interface GeminiCandidate { content?: { parts?: GeminiPart[] } }
interface GeminiResponse { candidates?: GeminiCandidate[] }
interface EmbedResponse { embeddings?: Array<{ values: number[] }> }

/**
 * Minimal, self-contained Gemini REST client.
 * Only used when the host app does not inject Prophezy's AI Core Engine —
 * see `engine.adapter.ts`.
 */
export class GeminiClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor() {
    const env = getEnv();
    if (!env.geminiApiKey) throw new ProviderUnconfiguredError('gemini', ['GEMINI_API_KEY']);
    this.apiKey = env.geminiApiKey;
    this.model = env.geminiModel;
    this.embeddingModel = env.geminiEmbeddingModel;
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string, options: AIRunOptions): Promise<T> {
    const url = `${BASE}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await httpRequest<GeminiResponse>('gemini', url, {
      method: 'POST',
      timeoutMs: 45_000,
      signal: options.signal,
      body: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxOutputTokens ?? 2_048,
          responseMimeType: 'application/json',
        },
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) throw new EngineError('AI_EMPTY_RESPONSE', 'Model returned no content');
    return parseJsonLoose<T>(text);
  }

  async embed(input: string | string[]): Promise<number[][]> {
    const inputs = Array.isArray(input) ? input : [input];
    const url = `${BASE}/models/${this.embeddingModel}:batchEmbedContents?key=${encodeURIComponent(this.apiKey)}`;
    const response = await httpRequest<EmbedResponse>('gemini', url, {
      method: 'POST',
      timeoutMs: 30_000,
      body: {
        requests: inputs.map((text) => ({
          model: `models/${this.embeddingModel}`,
          content: { parts: [{ text: text.slice(0, 20_000) }] },
          taskType: 'SEMANTIC_SIMILARITY',
          // Without this, gemini-embedding-001 (and possibly whatever
          // GEMINI_EMBEDDING_MODEL is currently configured to) returns its
          // full-length embedding — 3072 dimensions by default — while the
          // `internships.embedding` column and EMBEDDING_DIMENSIONS both
          // expect 768. That mismatch is exactly what
          // "expected 768 dimensions, not 3072" was: backfillEmbeddings()
          // failing on every sync run, silently, embeddingsBackfilled: 0
          // every time. Requesting the matching size here (same field name
          // casing as the already-working `taskType` above, confirmed
          // against Google's docs for this endpoint) means every future
          // embedding call actually fits the schema instead of erroring.
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      },
    });
    return (response.embeddings ?? []).map((e) => e.values);
  }
}

/** Tolerates fenced blocks, preambles and trailing commas. */
export function parseJsonLoose<T>(raw: string): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();

  const firstBrace = text.search(/[[{]/);
  if (firstBrace > 0) text = text.slice(firstBrace);
  const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (lastBrace >= 0) text = text.slice(0, lastBrace + 1);

  try {
    return JSON.parse(text) as T;
  } catch {
    const repaired = text.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001F]/g, ' ');
    try {
      return JSON.parse(repaired) as T;
    } catch (error) {
      throw new EngineError('AI_INVALID_JSON', `Model returned unparseable JSON: ${(error as Error).message}`);
    }
  }
}
