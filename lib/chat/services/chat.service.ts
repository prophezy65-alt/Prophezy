/**
 * lib/chat/services/chat.service.ts
 *
 * Not to be confused with lib/ai/services/chat.service.ts (the AI Core
 * Engine's generic streaming primitive, reused below). This is the
 * feature-level entry point: one function, `sendMessage()`, that an API
 * route calls for every chat turn. Internally it runs the orchestrator
 * (intent -> plan -> route -> synthesize) and, for the plain-conversation
 * case where no module applies, falls through to the AI Core Engine's own
 * chat.service.ts for a normal streamed reply — never reimplementing that
 * streaming logic here.
 */

import { handleUserMessage } from "../orchestrator/orchestrator.service";
import { sendChatMessage as sendPlainChatMessage } from "../../ai/services/chat.service";
import type { StreamChunk } from "../../ai/config/client";
import { sendMessageSchema, type SendMessageInput } from "../validation/chat-schemas";
import { preScreenChatMessage } from "../utils/security";

const CHAT_SYSTEM_INSTRUCTION =
  "You are Prophezy's assistant — warm, direct, and genuinely helpful for a student's " +
  "academic and career work. This turn didn't need a specific module, so just have a normal, " +
  "helpful conversation.";

export type SendMessageResult =
  | { kind: "text"; message: string; suggestedNextSteps: string[] }
  | { kind: "stream"; chunks: AsyncGenerator<StreamChunk, void, unknown> }
  | { kind: "clarification"; question: string };

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const parsed = sendMessageSchema.parse(input);
  const screened = preScreenChatMessage(parsed.message);

  const outcome = await handleUserMessage({
    sessionId: parsed.sessionId,
    userId: parsed.userId,
    message: screened.clean,
  });

  switch (outcome.kind) {
    case "clarification_needed":
      return { kind: "clarification", question: outcome.question };

    case "modules_executed":
      return { kind: "text", message: outcome.message, suggestedNextSteps: outcome.suggestedNextSteps };

    case "plain_chat":
      return {
        kind: "stream",
        chunks: sendPlainChatMessage({
          sessionId: parsed.sessionId,
          userId: parsed.userId,
          feature: "chat",
          systemInstruction: CHAT_SYSTEM_INSTRUCTION,
          userMessage: screened.clean,
        }),
      };

    default: {
      const _exhaustive: never = outcome;
      throw new Error(`Unhandled orchestrator outcome: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
