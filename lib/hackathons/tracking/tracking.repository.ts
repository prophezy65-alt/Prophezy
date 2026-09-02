/**
 * tracking.repository.ts
 * DB-agnostic persistence interface for hackathon tracking (saved,
 * registered, in-progress, submitted, completed) and submissions.
 * Implemented against Supabase by the Database Backend layer and injected
 * into tracking.service.ts — this module never imports a DB client
 * directly.
 */

import { HackathonTrackingEntry, Submission, UserId, HackathonId, TrackingStatus } from "../models/hackathon.model";

export interface TrackingRepository {
  upsertTrackingEntry(entry: HackathonTrackingEntry): Promise<HackathonTrackingEntry>;
  getTrackingEntry(userId: UserId, hackathonId: HackathonId): Promise<HackathonTrackingEntry | null>;
  listTrackingEntries(userId: UserId, status?: TrackingStatus): Promise<HackathonTrackingEntry[]>;
  deleteTrackingEntry(userId: UserId, hackathonId: HackathonId): Promise<void>;

  upsertSubmission(submission: Submission): Promise<Submission>;
  getSubmission(userId: UserId, hackathonId: HackathonId): Promise<Submission | null>;
}

/**
 * In-memory reference implementation for local dev/tests. Replace with a
 * real Supabase-backed repository in production.
 */
export function createInMemoryTrackingRepository(): TrackingRepository {
  const entries = new Map<string, HackathonTrackingEntry>();
  const submissions = new Map<string, Submission>();

  const entryKey = (userId: UserId, hackathonId: HackathonId) => `${userId}:${hackathonId}`;

  return {
    async upsertTrackingEntry(entry) {
      entries.set(entryKey(entry.userId, entry.hackathonId), entry);
      return entry;
    },
    async getTrackingEntry(userId, hackathonId) {
      return entries.get(entryKey(userId, hackathonId)) ?? null;
    },
    async listTrackingEntries(userId, status) {
      const all = [...entries.values()].filter((e) => e.userId === userId);
      return status ? all.filter((e) => e.status === status) : all;
    },
    async deleteTrackingEntry(userId, hackathonId) {
      entries.delete(entryKey(userId, hackathonId));
    },
    async upsertSubmission(submission) {
      submissions.set(entryKey(submission.userId, submission.hackathonId), submission);
      return submission;
    },
    async getSubmission(userId, hackathonId) {
      return submissions.get(entryKey(userId, hackathonId)) ?? null;
    },
  };
}
