/**
 * lib/hackathons/providers/tracking.repository.supabase.ts
 *
 * Real Supabase-backed implementation of TrackingRepository
 * (tracking/tracking.repository.ts), backed by public.hackathon_registrations
 * (0037_hackathon_engine.sql). "Save/unsave" and "bookmark" both map to
 * status = 'saved' here — see that migration's comment for why the
 * original proposal's separate `saved_hackathons` table was dropped.
 *
 * Submissions (upsertSubmission/getSubmission) are backed by
 * public.hackathon_progress's `submission` jsonb column rather than a
 * dedicated table — the promoted migration already has that column
 * sitting unused for exactly this shape; no schema change needed.
 */

import type { TrackingRepository } from "../tracking/tracking.repository";
import type { HackathonTrackingEntry, Submission, UserId, HackathonId } from "../models/hackathon.model";

export interface MinimalSupabaseClient {
  from(table: string): any;
}

interface RegistrationRow {
  id: string;
  user_id: string;
  hackathon_id: string;
  status: HackathonTrackingEntry["status"];
  preparation_progress_percent: number;
  submission_progress_percent: number;
  notes: string | null;
  updated_at: string;
}

function rowToEntry(row: RegistrationRow): HackathonTrackingEntry {
  return {
    id: row.id,
    userId: row.user_id,
    hackathonId: row.hackathon_id,
    status: row.status,
    preparationProgressPercent: row.preparation_progress_percent,
    submissionProgressPercent: row.submission_progress_percent,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at,
  };
}

export class SupabaseTrackingRepository implements TrackingRepository {
  constructor(private readonly client: MinimalSupabaseClient) {}

  async upsertTrackingEntry(entry: HackathonTrackingEntry): Promise<HackathonTrackingEntry> {
    const { data, error } = await this.client
      .from("hackathon_registrations")
      .upsert(
        {
          user_id: entry.userId,
          hackathon_id: entry.hackathonId,
          status: entry.status,
          preparation_progress_percent: entry.preparationProgressPercent,
          submission_progress_percent: entry.submissionProgressPercent,
          notes: entry.notes ?? null,
          updated_at: entry.updatedAt,
        },
        { onConflict: "user_id,hackathon_id" }
      )
      .select("*")
      .single();
    if (error) throw new Error(`SupabaseTrackingRepository.upsertTrackingEntry failed: ${error.message}`);
    return rowToEntry(data as RegistrationRow);
  }

  async getTrackingEntry(userId: UserId, hackathonId: HackathonId): Promise<HackathonTrackingEntry | null> {
    const { data, error } = await this.client
      .from("hackathon_registrations")
      .select("*")
      .eq("user_id", userId)
      .eq("hackathon_id", hackathonId)
      .maybeSingle();
    if (error) throw new Error(`SupabaseTrackingRepository.getTrackingEntry failed: ${error.message}`);
    return data ? rowToEntry(data as RegistrationRow) : null;
  }

  async listTrackingEntries(userId: UserId, status?: HackathonTrackingEntry["status"]): Promise<HackathonTrackingEntry[]> {
    let query = this.client.from("hackathon_registrations").select("*").eq("user_id", userId);
    if (status) query = query.eq("status", status);
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) throw new Error(`SupabaseTrackingRepository.listTrackingEntries failed: ${error.message}`);
    return (data as RegistrationRow[]).map(rowToEntry);
  }

  async deleteTrackingEntry(userId: UserId, hackathonId: HackathonId): Promise<void> {
    const { error } = await this.client
      .from("hackathon_registrations")
      .delete()
      .eq("user_id", userId)
      .eq("hackathon_id", hackathonId);
    if (error) throw new Error(`SupabaseTrackingRepository.deleteTrackingEntry failed: ${error.message}`);
  }

  async upsertSubmission(submission: Submission): Promise<Submission> {
    const { error } = await this.client.from("hackathon_progress").upsert(
      {
        user_id: submission.userId,
        hackathon_id: submission.hackathonId,
        submission,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,hackathon_id" }
    );
    if (error) throw new Error(`SupabaseTrackingRepository.upsertSubmission failed: ${error.message}`);
    return submission;
  }

  async getSubmission(userId: UserId, hackathonId: HackathonId): Promise<Submission | null> {
    const { data, error } = await this.client
      .from("hackathon_progress")
      .select("submission")
      .eq("user_id", userId)
      .eq("hackathon_id", hackathonId)
      .maybeSingle();
    if (error) throw new Error(`SupabaseTrackingRepository.getSubmission failed: ${error.message}`);
    return (data?.submission as Submission | undefined) ?? null;
  }
}
