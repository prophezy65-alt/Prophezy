import "server-only";
import { createClient } from "@/lib/supabase/server";
import { StudyHubError } from "../errors";
import type { StudySession } from "../types";

function toSession(row: {
  id: string;
  user_id: string;
  subject: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
}): StudySession {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export class StudySessionsRepository {
  async start(userId: string, subject: string | null): Promise<StudySession> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("study_sessions")
      .insert({ user_id: userId, subject, started_at: new Date().toISOString() })
      .select()
      .single();

    if (error || !data) throw new StudyHubError(error?.message ?? "Failed to start session.", "DB_WRITE_FAILED", 500);
    return toSession(data);
  }

  async end(userId: string, sessionId: string, notes: string | null): Promise<StudySession> {
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("study_sessions")
      .select("started_at")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existing) throw new StudyHubError("Session not found.", "NOT_FOUND", 404);

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - new Date(existing.started_at).getTime()) / 1000),
    );

    const { data, error } = await supabase
      .from("study_sessions")
      .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds, notes })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) throw new StudyHubError(error?.message ?? "Failed to end session.", "DB_WRITE_FAILED", 500);
    return toSession(data);
  }

  /** All sessions with a recorded duration, most recent first — used for
   *  analytics/streak derivation. `sinceDays` bounds the query so a
   *  long-lived account doesn't pull its entire history every time. */
  async listCompleted(userId: string, sinceDays = 120): Promise<StudySession[]> {
    const supabase = await createClient();
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .not("ended_at", "is", null)
      .gte("started_at", since)
      .order("started_at", { ascending: false });

    if (error) throw new StudyHubError(error.message, "DB_READ_FAILED", 500);
    return (data ?? []).map(toSession);
  }

  async listActive(userId: string): Promise<StudySession[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false });

    if (error) throw new StudyHubError(error.message, "DB_READ_FAILED", 500);
    return (data ?? []).map(toSession);
  }
}
