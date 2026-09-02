/**
 * tracking-analytics.ts
 * Aggregates a user's tracking entries into dashboard-ready analytics:
 * counts by status, upcoming deadlines, and overall preparation progress.
 * Deterministic — operates on already-fetched tracking data.
 */

import { HackathonTrackingEntry, TrackingStatus } from "../models/hackathon.model";

export interface TrackingAnalytics {
  totalTracked: number;
  countByStatus: Record<TrackingStatus, number>;
  averagePreparationProgressPercent: number;
  averageSubmissionProgressPercent: number;
}

const ALL_STATUSES: TrackingStatus[] = ["saved", "registered", "in_progress", "submitted", "completed", "withdrawn"];

export function buildTrackingAnalytics(entries: HackathonTrackingEntry[]): TrackingAnalytics {
  const countByStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<TrackingStatus, number>;
  entries.forEach((e) => {
    countByStatus[e.status] = (countByStatus[e.status] ?? 0) + 1;
  });

  const activeEntries = entries.filter((e) => e.status !== "withdrawn");
  const avgPrep = activeEntries.length
    ? Math.round(activeEntries.reduce((sum, e) => sum + e.preparationProgressPercent, 0) / activeEntries.length)
    : 0;
  const avgSubmission = activeEntries.length
    ? Math.round(activeEntries.reduce((sum, e) => sum + e.submissionProgressPercent, 0) / activeEntries.length)
    : 0;

  return {
    totalTracked: entries.length,
    countByStatus,
    averagePreparationProgressPercent: avgPrep,
    averageSubmissionProgressPercent: avgSubmission,
  };
}
