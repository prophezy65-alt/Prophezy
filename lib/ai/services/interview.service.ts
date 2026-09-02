/**
 * lib/ai/services/interview.service.ts
 *
 * Conversational mock-interview service. Unlike the one-shot feature
 * services, this keeps a session (lib/ai/memory/session.ts), trims it to
 * fit the model's context window, and streams the interviewer's next
 * question/feedback back to the frontend turn by turn.
 */

import { runAIStream } from "../engine";
import type { StreamChunk } from "../config/client";
import {
  buildInterviewSystemPrompt,
  INTERVIEW_GENERATION,
  type InterviewSessionConfig,
} from "../prompts/interview";
import { getOrCreateSession, appendMessage } from "../memory/session";
import { ensureWithinContextWindow, assembleMessages } from "../memory/context-manager";
import { MODELS } from "../config/models";
import { resolveModelForFeature } from "../config/models";

export async function startInterviewSession(
  sessionId: string,
  userId: string,
  config: InterviewSessionConfig
): Promise<void> {
  await getOrCreateSession(sessionId, "interview", userId);
  await appendMessage(sessionId, {
    role: "user",
    parts: [{ text: "Begin the interview with your first question." }],
  });
}

/**
 * Sends the candidate's answer, appends it to session history, and streams
 * back the interviewer's feedback + next question.
 */
export async function* respondToAnswer(
  sessionId: string,
  userId: string,
  config: InterviewSessionConfig,
  candidateAnswer: string
): AsyncGenerator<StreamChunk, void, unknown> {
  const session = await getOrCreateSession(sessionId, "interview", userId);
  await appendMessage(sessionId, { role: "user", parts: [{ text: candidateAnswer }] });

  const refreshed = await getOrCreateSession(sessionId, "interview", userId);
  const model = resolveModelForFeature("interview");
  const { messages } = await ensureWithinContextWindow(refreshed, MODELS[model.id].contextWindow);
  const finalMessages = assembleMessages({ ...refreshed, messages });

  let accumulated = "";
  for await (const chunk of runAIStream({
    feature: "interview",
    userId,
    systemInstruction: buildInterviewSystemPrompt(config),
    messages: finalMessages,
    temperature: INTERVIEW_GENERATION.temperature,
    maxOutputTokens: INTERVIEW_GENERATION.maxOutputTokens,
  })) {
    accumulated = chunk.accumulated;
    yield chunk;
  }

  await appendMessage(sessionId, { role: "model", parts: [{ text: accumulated }] });
}
