/**
 * Centralized, lazily-read environment access.
 * Never throws at import time — a missing key only degrades the provider that needs it.
 */

export interface EngineEnv {
  supabaseUrl: string;
  supabaseServiceKey: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  redisUrl: string | null;
  redisToken: string | null;
  syncSecret: string | null;
  appUrl: string;
}

function read(key: string): string | null {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function requireEnv(key: string): string {
  const value = read(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function hasEnv(keys: readonly string[]): boolean {
  return keys.every((key) => read(key) !== null);
}

export function getEnv(): EngineEnv {
  return {
    supabaseUrl: read('NEXT_PUBLIC_SUPABASE_URL') ?? read('SUPABASE_URL') ?? '',
    supabaseServiceKey: read('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    geminiApiKey: read('GEMINI_API_KEY') ?? read('GOOGLE_GENERATIVE_AI_API_KEY') ?? '',
    geminiModel: read('GEMINI_MODEL') ?? 'gemini-2.5-flash',
    geminiEmbeddingModel: read('GEMINI_EMBEDDING_MODEL') ?? 'gemini-embedding-001',
    redisUrl: read('UPSTASH_REDIS_REST_URL') ?? read('UPSTASH_REDIS_URL'),
    redisToken: read('UPSTASH_REDIS_REST_TOKEN') ?? read('UPSTASH_REDIS_TOKEN'),
    syncSecret: read('INTERNSHIP_SYNC_SECRET'),
    appUrl: read('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',
  };
}
