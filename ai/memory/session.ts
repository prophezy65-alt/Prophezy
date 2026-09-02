/**
 * lib/ai/memory/session.ts
 *
 * In-memory-model, Redis-persisted conversation sessions for the chat-style
 * features (interview prep, research assistant, general chat). Each session
 * is keyed by an id the frontend generates and stores (e.g. in the URL or a
 * cookie) — this module has no concept of "current user's active chat", it
 * just stores/retrieves whatever session id it's given.
 *
 * Uses Upstash Redis so it works the same in serverless/Edge as the rest of
 * the engine — same env vars as middleware/rate-limit.ts and middleware/cache.ts.
 */

import { Redis } from "@upstash/redis";
import type { GeminiMessage } from "../config/client";

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set.");
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h idle expiry

export interface SessionRecord {
  sessionId: string;
  feature: string;
  userId: string;
  messages: GeminiMessage[];
  /** Running summary of turns that were trimmed out of `messages` to stay in-window */
  rollingSummary: string;
  createdAt: number;
  updatedAt: number;
}

function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

export async function createSession(
  sessionId: string,
  feature: string,
  userId: string
): Promise<SessionRecord> {
  const record: SessionRecord = {
    sessionId,
    feature,
    userId,
    messages: [],
    rollingSummary: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await getRedis().set(sessionKey(sessionId), record, { ex: SESSION_TTL_SECONDS });
  return record;
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  return getRedis().get<SessionRecord>(sessionKey(sessionId));
}

export async function getOrCreateSession(
  sessionId: string,
  feature: string,
  userId: string
): Promise<SessionRecord> {
  const existing = await getSession(sessionId);
  if (existing) return existing;
  return createSession(sessionId, feature, userId);
}

export async function appendMessage(
  sessionId: string,
  message: GeminiMessage
): Promise<SessionRecord> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} does not exist. Call getOrCreateSession first.`);
  }
  session.messages.push(message);
  session.updatedAt = Date.now();
  await getRedis().set(sessionKey(sessionId), session, { ex: SESSION_TTL_SECONDS });
  return session;
}

export async function setRollingSummary(sessionId: string, summary: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  session.rollingSummary = summary;
  session.updatedAt = Date.now();
  await getRedis().set(sessionKey(sessionId), session, { ex: SESSION_TTL_SECONDS });
}

export async function replaceMessages(
  sessionId: string,
  messages: GeminiMessage[]
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  session.messages = messages;
  session.updatedAt = Date.now();
  await getRedis().set(sessionKey(sessionId), session, { ex: SESSION_TTL_SECONDS });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getRedis().del(sessionKey(sessionId));
}
