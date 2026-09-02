/**
 * tracking.service.ts
 * "Tracking" features: saved/registered/completed hackathons, submission
 * progress, preparation progress. DB-agnostic via `TrackingRepository`.
 */

import {
  UserId,
  HackathonId,
  TrackingStatus,
  HackathonTrackingEntry,
  Submission,
  Checklist,
  ServiceResult,
  success,
  failure,
} from "../models/hackathon.model";
import { TrackingRepository } from "../tracking/tracking.repository";
import { calculateChecklistProgress } from "../utils/checklist-generator";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export class TrackingService {
  constructor(private readonly repo: TrackingRepository) {}

  async setStatus(
    userId: UserId,
    hackathonId: HackathonId,
    status: TrackingStatus,
    notes?: string
  ): Promise<ServiceResult<HackathonTrackingEntry>> {
    const existing = await this.repo.getTrackingEntry(userId, hackathonId);

    const entry: HackathonTrackingEntry = {
      id: existing?.id ?? generateId("tracking"),
      userId,
      hackathonId,
      status,
      preparationProgressPercent: existing?.preparationProgressPercent ?? 0,
      submissionProgressPercent: existing?.submissionProgressPercent ?? 0,
      notes: notes ?? existing?.notes,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.repo.upsertTrackingEntry(entry);
    return success(saved);
  }

  async updatePreparationProgress(
    userId: UserId,
    hackathonId: HackathonId,
    percent: number
  ): Promise<ServiceResult<HackathonTrackingEntry>> {
    const existing = await this.repo.getTrackingEntry(userId, hackathonId);
    if (!existing) return failure("NOT_FOUND", "No tracking entry found for this hackathon. Save it first.");

    const updated: HackathonTrackingEntry = {
      ...existing,
      preparationProgressPercent: Math.max(0, Math.min(100, Math.round(percent))),
      updatedAt: new Date().toISOString(),
    };

    return success(await this.repo.upsertTrackingEntry(updated));
  }

  async recalculateSubmissionProgressFromChecklist(
    userId: UserId,
    hackathonId: HackathonId,
    checklist: Checklist
  ): Promise<ServiceResult<HackathonTrackingEntry>> {
    const existing = await this.repo.getTrackingEntry(userId, hackathonId);
    if (!existing) return failure("NOT_FOUND", "No tracking entry found for this hackathon. Save it first.");

    const progress = calculateChecklistProgress(checklist);
    const updated: HackathonTrackingEntry = {
      ...existing,
      submissionProgressPercent: progress,
      updatedAt: new Date().toISOString(),
    };

    return success(await this.repo.upsertTrackingEntry(updated));
  }

  async listByStatus(userId: UserId, status?: TrackingStatus): Promise<ServiceResult<HackathonTrackingEntry[]>> {
    return success(await this.repo.listTrackingEntries(userId, status));
  }

  async remove(userId: UserId, hackathonId: HackathonId): Promise<ServiceResult<null>> {
    await this.repo.deleteTrackingEntry(userId, hackathonId);
    return success(null);
  }

  async saveSubmission(submission: Submission): Promise<ServiceResult<Submission>> {
    const saved = await this.repo.upsertSubmission(submission);
    return success(saved);
  }

  async getSubmission(userId: UserId, hackathonId: HackathonId): Promise<ServiceResult<Submission>> {
    const submission = await this.repo.getSubmission(userId, hackathonId);
    if (!submission) return failure("NOT_FOUND", "No submission found for this hackathon.");
    return success(submission);
  }
}
