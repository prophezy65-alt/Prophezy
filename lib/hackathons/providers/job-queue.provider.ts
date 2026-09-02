/**
 * job-queue.provider.ts
 * Interface for enqueueing background jobs (provider sync runs, deadline
 * notification scans). This module defines the jobs and their handlers'
 * *shape*; actual queue infrastructure (BullMQ/Redis, GitHub Actions cron,
 * Supabase cron) is wired in by the app.
 */

export type HackathonJobType =
  | "sync_provider"
  | "scan_deadline_reminders"
  | "scan_new_hackathon_alerts"
  | "refresh_recommendations";

export interface HackathonJobPayloadMap {
  sync_provider: { sourceId: string };
  scan_deadline_reminders: { withinHours: number };
  scan_new_hackathon_alerts: Record<string, never>;
  refresh_recommendations: { userId: string };
}

export interface JobQueueProvider {
  enqueue<T extends HackathonJobType>(type: T, payload: HackathonJobPayloadMap[T]): Promise<void>;
}

/**
 * In-memory/no-op queue for local dev and tests — runs nothing, just logs
 * intent. Replace with a real queue (BullMQ + Redis, or GitHub Actions
 * scheduled workflow dispatch) in production.
 */
export function createNoopJobQueueProvider(onEnqueue?: (type: string, payload: unknown) => void): JobQueueProvider {
  return {
    async enqueue(type, payload) {
      onEnqueue?.(type, payload);
    },
  };
}
