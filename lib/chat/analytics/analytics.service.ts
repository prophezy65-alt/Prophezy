/**
 * lib/chat/analytics/analytics.service.ts
 *
 * Aggregations over chat_messages.intent/modules_invoked and
 * assistant_feedback — which modules get used most, how confident intent
 * detection typically is, thumbs up/down ratio. Pure functions over
 * already-fetched rows; the provider does the fetching so this stays
 * testable without a DB.
 */

import type { AssistantFeedback, ChatMessage, ChatModuleId } from "../types/chat.types";

export interface ModuleUsageStats {
  module: ChatModuleId;
  invocationCount: number;
  averageConfidence: number;
}

export function computeModuleUsage(messages: ChatMessage[]): ModuleUsageStats[] {
  const byModule = new Map<ChatModuleId, { count: number; confidenceSum: number; confidenceCount: number }>();

  for (const message of messages) {
    if (!message.modulesInvoked) continue;
    for (const moduleId of message.modulesInvoked) {
      const bucket = byModule.get(moduleId) ?? { count: 0, confidenceSum: 0, confidenceCount: 0 };
      bucket.count += 1;
      byModule.set(moduleId, bucket);
    }
    if (message.intent) {
      for (const m of message.intent.modules) {
        const bucket = byModule.get(m.module) ?? { count: 0, confidenceSum: 0, confidenceCount: 0 };
        bucket.confidenceSum += m.confidence;
        bucket.confidenceCount += 1;
        byModule.set(m.module, bucket);
      }
    }
  }

  return [...byModule.entries()]
    .map(([module, b]) => ({
      module,
      invocationCount: b.count,
      averageConfidence: b.confidenceCount > 0 ? Math.round((b.confidenceSum / b.confidenceCount) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.invocationCount - a.invocationCount);
}

export interface FeedbackSummary {
  totalFeedback: number;
  thumbsUpPct: number;
  commentsCount: number;
}

export function summarizeFeedback(feedback: AssistantFeedback[]): FeedbackSummary {
  const total = feedback.length;
  const thumbsUp = feedback.filter((f) => f.rating === "thumbs_up").length;
  const commentsCount = feedback.filter((f) => !!f.comment).length;

  return {
    totalFeedback: total,
    thumbsUpPct: total > 0 ? Math.round((thumbsUp / total) * 10000) / 100 : 0,
    commentsCount,
  };
}

/** Distribution of clarification-needed turns vs. confidently-routed turns — a rising clarification rate signals intent-detection.prompt.ts needs tuning. */
export function computeClarificationRate(messages: ChatMessage[]): number {
  const withIntent = messages.filter((m) => m.intent !== null);
  if (withIntent.length === 0) return 0;
  const clarifications = withIntent.filter((m) => m.intent!.needsClarification).length;
  return Math.round((clarifications / withIntent.length) * 10000) / 100;
}
