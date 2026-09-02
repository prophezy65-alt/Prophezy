/**
 * lib/chat/utils/security.ts
 *
 * lib/ai/middleware/safety.ts already sanitizes every message inside
 * runAI()/runAIStream() — this is a second, chat-specific pre-check applied
 * at the point a raw user message enters the orchestrator, before it's
 * even used to build a conversationContext string or get classified by
 * intent detection. Same rationale as lib/quiz/utils/security.ts: flags,
 * doesn't silently strip — the system prompt boundary and safety.ts are
 * the actual defense.
 */

const MAX_MESSAGE_LENGTH = 8000;

const SUSPICIOUS_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /you are now/i,
  /system prompt/i,
  /disregard (all )?(previous|prior) (rules|instructions)/i,
  /reveal your (system )?prompt/i,
];

export interface ScreenedMessage {
  clean: string;
  flagged: boolean;
  reasons: string[];
}

export function preScreenChatMessage(raw: string): ScreenedMessage {
  const clean = raw.slice(0, MAX_MESSAGE_LENGTH).trim();
  const reasons = SUSPICIOUS_PATTERNS.filter((p) => p.test(clean)).map((p) => p.source);
  return { clean, flagged: reasons.length > 0, reasons };
}
