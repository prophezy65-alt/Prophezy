/**
 * lib/ai/services/interview.service.ts
 *
 * Conversational mock-interview service. Unlike the one-shot feature
 * services, this keeps a session (lib/ai/memory/session.ts), trims it to
 * fit the model's context window, and streams the interviewer's next
 * question/feedback back to the frontend turn by turn.
 *
 * Credit gating (Phase 4): ONLY respondToAnswer() calls Gemini
 * (runAIStream) — startInterviewSession() just creates the session and
 * appends a "begin the interview" trigger message, no AI call happens
 * there at all. So only respondToAnswer() is credit-gated
 * (INTERVIEW_AI_ACTION, 3 credits per turn); charging on
 * startInterviewSession() would be charging for a zero-cost action, which
 * violates the same "don't charge for browsing" principle as not charging
 * for viewing a note or searching internships.
 *
 * respondToAnswer() is an AsyncGenerator, so it uses
 * spendCreditsForStreamingFeature() (spends before the stream starts,
 * refunds if the stream throws at any point) rather than the Promise-based
 * spendCreditsForFeature() used by every other feature in lib/ai/services/.
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
import { spendCreditsForStreamingFeature, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";

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
 * back the interviewer's feedback + next question. Credit-gated: 1 charge
 * per call (per candidate turn), not per chunk.
 */
export async function* respondToAnswer(
  sessionId: string,
  userId: string,
  config: InterviewSessionConfig,
  candidateAnswer: string
): AsyncGenerator<StreamChunk, void, unknown> {
  const feature = CREDIT_FEATURES.INTERVIEW_AI_ACTION;
  const cost = await getFeatureCreditCost(feature);
  if (!cost) {
    throw new Error(`Interview AI is temporarily unavailable (no active credit cost configured for "${feature}").`);
  }

  yield* spendCreditsForStreamingFeature(
    userId,
    cost.creditCost,
    feature,
    () => respondToAnswerImpl(sessionId, userId, config, candidateAnswer),
    "Interview AI action"
  );
}

async function* respondToAnswerImpl(
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
