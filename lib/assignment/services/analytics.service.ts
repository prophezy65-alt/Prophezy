// lib/assignment/services/analytics.service.ts
//
// Mirrors the AI Core Engine's own analytics.ts pattern (per README.md:
// "Cost estimation + usage event logging (persist() is a no-op stub — wire
// it to `ai_usage_events` once the DB branch adds that table)"). Same shape
// here: logAnalyticsEvent() is the stable call site every service uses;
// swap `persist()`'s body for a real insert once an `assignment_analytics_events`
// table exists. This keeps the DB schema (explicitly out of scope for this
// module) decoupled from the moment we start emitting events.

import type { AssignmentAnalyticsEvent, SubjectMasteryStat, DetectedQuestion } from "../models/types";
import { logger } from "./_logger";

export async function logAnalyticsEvent(event: AssignmentAnalyticsEvent): Promise<void> {
  try {
    await persist(event);
  } catch (err) {
    // Analytics must never break the primary user-facing flow.
    logger.warn("assignment.analytics.persist_failed", { error: String(err), eventType: event.eventType });
  }
}

async function persist(event: AssignmentAnalyticsEvent): Promise<void> {
  // NO-OP STUB — intentionally, per DO-NOT-MODIFY database schema scope.
  // Wire this to `assignment_analytics_events` (or reuse `ai_usage_events`
  // with a `feature: 'assignment'` column) once that table exists:
  //
  //   await supabaseAdmin.from("assignment_analytics_events").insert({
  //     user_id: event.userId,
  //     document_id: event.documentId,
  //     event_type: event.eventType,
  //     metadata: event.metadata,
  //     created_at: event.timestamp,
  //   });
  logger.info("assignment.analytics.event", {
    userId: event.userId,
    documentId: event.documentId,
    eventType: event.eventType,
    ...event.metadata,
  });
}

/** Derives a per-subject/topic mastery snapshot from a set of questions the
 * user has engaged with. Pure aggregation — no AI, no DB — so the frontend
 * can call this on whatever question set it already has in memory (e.g. one
 * document, or a session's worth of activity) without a round trip. */
export function computeSubjectMasteryStats(questions: DetectedQuestion[]): SubjectMasteryStat[] {
  const difficultyScore: Record<DetectedQuestion["difficulty"], number> = {
    easy: 1,
    medium: 2,
    hard: 3,
    expert: 4,
  };

  const buckets = new Map<string, { subject: string; topic: string; count: number; difficultySum: number }>();

  for (const q of questions) {
    const key = `${q.subject}::${q.topic}`;
    const bucket = buckets.get(key) ?? { subject: q.subject, topic: q.topic, count: 0, difficultySum: 0 };
    bucket.count += 1;
    bucket.difficultySum += difficultyScore[q.difficulty];
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).map((b) => ({
    subject: b.subject,
    topic: b.topic,
    questionsAttempted: b.count,
    averageDifficulty: Math.round((b.difficultySum / b.count) * 100) / 100,
  }));
}
