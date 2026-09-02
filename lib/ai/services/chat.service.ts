/**
 * lib/ai/services/chat.service.ts
 *
 * Generic streaming chat used wherever a feature needs open-ended
 * back-and-forth rather than a one-shot structured result (e.g. "ask
 * follow-up questions about your generated roadmap"). Feature-specific
 * services (interview.service.ts) that need specialized system prompts
 * and post-turn processing build their own thin wrapper around the same
 * session + context-manager primitives instead of extending this file.
 */

import { runAIStream } from "../engine";
import type { StreamChunk } from "../config/client";
import { getOrCreateSession, appendMessage } from "../memory/session";
import { ensureWithinContextWindow, assembleMessages } from "../memory/context-manager";
import { resolveModelForFeature, MODELS } from "../config/models";

export interface ChatTurnParams {
  sessionId: string;
  userId: string;
  feature: string; // which feature's chat this belongs to, for rate limits/analytics/model routing
  systemInstruction: string;
  userMessage: string;
}

export async function* sendChatMessage(
  params: ChatTurnParams
): AsyncGenerator<StreamChunk, void, unknown> {
  await getOrCreateSession(params.sessionId, params.feature, params.userId);
  await appendMessage(params.sessionId, {
    role: "user",
    parts: [{ text: params.userMessage }],
  });

  const session = await getOrCreateSession(params.sessionId, params.feature, params.userId);
  const model = resolveModelForFeature(params.feature);
  const { messages } = await ensureWithinContextWindow(session, MODELS[model.id].contextWindow);
  const finalMessages = assembleMessages({ ...session, messages });

  let accumulated = "";
  for await (const chunk of runAIStream({
    feature: params.feature,
    userId: params.userId,
    systemInstruction: params.systemInstruction,
    messages: finalMessages,
  })) {
    accumulated = chunk.accumulated;
    yield chunk;
  }

  await appendMessage(params.sessionId, { role: "model", parts: [{ text: accumulated }] });
}
