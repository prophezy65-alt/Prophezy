/**
 * career.repository.ts
 *
 * Supabase persistence for the Career Guidance module. The services in
 * lib/career/services/* stay DB-agnostic (per lib/career/README.md) — this
 * repository is the one place API routes go to read/write career data.
 *
 * Advisor chat history intentionally reuses the existing chat_sessions /
 * chat_messages tables (tagged with the existing 'career_guidance_ai' chat
 * module) instead of a new table, so the module doesn't duplicate schema
 * lib/chat already owns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CareerAnalytics, LearningRoadmap, SkillGapAnalysis, UserId } from "../models/career.model";

type DB = SupabaseClient<Database>;

export interface SavedRoadmap {
  id: string;
  targetRole: string;
  roadmap: LearningRoadmap;
  totalEstimatedWeeks: number;
  progress: Record<string, { completed: boolean; completedAt?: string }>;
  createdAt: string;
}

export class CareerRepository {
  constructor(private readonly db: DB) {}

  // -- Roadmaps --------------------------------------------------------

  async saveRoadmap(userId: UserId, roadmap: LearningRoadmap): Promise<SavedRoadmap> {
    const { data, error } = await this.db
      .from("career_roadmaps")
      .insert({
        user_id: userId,
        target_role: roadmap.targetRole,
        content: roadmap as unknown as Database["public"]["Tables"]["career_roadmaps"]["Insert"]["content"],
        total_estimated_weeks: roadmap.totalEstimatedWeeks,
        progress: {},
      })
      .select("id, target_role, content, total_estimated_weeks, progress, created_at")
      .single();

    if (error) throw error;
    return toSavedRoadmap(data);
  }

  async listRoadmaps(userId: UserId): Promise<SavedRoadmap[]> {
    const { data, error } = await this.db
      .from("career_roadmaps")
      .select("id, target_role, content, total_estimated_weeks, progress, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toSavedRoadmap);
  }

  async getRoadmap(userId: UserId, roadmapId: string): Promise<SavedRoadmap | null> {
    const { data, error } = await this.db
      .from("career_roadmaps")
      .select("id, target_role, content, total_estimated_weeks, progress, created_at")
      .eq("user_id", userId)
      .eq("id", roadmapId)
      .maybeSingle();

    if (error) throw error;
    return data ? toSavedRoadmap(data) : null;
  }

  async deleteRoadmap(userId: UserId, roadmapId: string): Promise<void> {
    const { error } = await this.db.from("career_roadmaps").delete().eq("user_id", userId).eq("id", roadmapId);
    if (error) throw error;
  }

  /** Deletes any existing roadmap(s) for this exact target role, so regenerating doesn't pile up duplicates. */
  async deleteRoadmapsByRole(userId: UserId, targetRole: string): Promise<void> {
    const { error } = await this.db
      .from("career_roadmaps")
      .delete()
      .eq("user_id", userId)
      .eq("target_role", targetRole);
    if (error) throw error;
  }

  async setMilestoneProgress(
    userId: UserId,
    roadmapId: string,
    milestoneId: string,
    completed: boolean
  ): Promise<SavedRoadmap | null> {
    const existing = await this.getRoadmap(userId, roadmapId);
    if (!existing) return null;

    const nextProgress = {
      ...existing.progress,
      [milestoneId]: completed
        ? { completed: true, completedAt: new Date().toISOString() }
        : { completed: false },
    };

    const { data, error } = await this.db
      .from("career_roadmaps")
      .update({ progress: nextProgress })
      .eq("user_id", userId)
      .eq("id", roadmapId)
      .select("id, target_role, content, total_estimated_weeks, progress, created_at")
      .single();

    if (error) throw error;
    return toSavedRoadmap(data);
  }

  // -- Analytics snapshots ----------------------------------------------

  async saveAnalyticsSnapshot(userId: UserId, analytics: CareerAnalytics): Promise<void> {
    const { error } = await this.db.from("career_analytics_snapshots").insert({
      user_id: userId,
      analytics: analytics as unknown as Database["public"]["Tables"]["career_analytics_snapshots"]["Insert"]["analytics"],
    });
    if (error) throw error;
  }

  async getLatestAnalyticsSnapshot(userId: UserId): Promise<{ analytics: CareerAnalytics; generatedAt: string } | null> {
    const { data, error } = await this.db
      .from("career_analytics_snapshots")
      .select("analytics, generated_at")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return { analytics: data.analytics as unknown as CareerAnalytics, generatedAt: data.generated_at };
  }

  // -- Skill gap reports --------------------------------------------------

  async saveSkillGapReport(userId: UserId, report: SkillGapAnalysis): Promise<void> {
    const { error } = await this.db.from("career_skill_gap_reports").insert({
      user_id: userId,
      target_role: report.targetRole,
      content: report as unknown as Database["public"]["Tables"]["career_skill_gap_reports"]["Insert"]["content"],
    });
    if (error) throw error;
  }

  async getLatestSkillGapReport(userId: UserId, targetRole: string): Promise<SkillGapAnalysis | null> {
    const { data, error } = await this.db
      .from("career_skill_gap_reports")
      .select("content")
      .eq("user_id", userId)
      .eq("target_role", targetRole)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? (data.content as unknown as SkillGapAnalysis) : null;
  }

  // -- Advisor chat (reuses chat_sessions / chat_messages) ---------------

  async createAdvisorSession(userId: UserId, title: string): Promise<string> {
    const { data, error } = await this.db
      .from("chat_sessions")
      .insert({ user_id: userId, title, metadata: { module: "career_guidance_ai" } })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  async appendAdvisorMessage(sessionId: string, role: "user" | "assistant", content: string): Promise<void> {
    const { error: msgError } = await this.db.from("chat_messages").insert({
      session_id: sessionId,
      role,
      content,
      modules_invoked: role === "assistant" ? ["career_guidance_ai"] : null,
    });
    if (msgError) throw msgError;

    const { error: sessionError } = await this.db
      .from("chat_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (sessionError) throw sessionError;
  }

  async listAdvisorSessions(userId: UserId) {
    const { data, error } = await this.db
      .from("chat_sessions")
      .select("id, title, last_message_at, created_at")
      .eq("user_id", userId)
      .contains("metadata", { module: "career_guidance_ai" })
      .order("last_message_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getAdvisorMessages(userId: UserId, sessionId: string) {
    // RLS already scopes chat_sessions/chat_messages to auth.uid(), but we
    // also verify ownership explicitly so a wrong/foreign sessionId returns
    // an empty list instead of relying solely on the policy.
    const { data: session } = await this.db
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!session) return [];

    const { data, error } = await this.db
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  /** Deletes an advisor chat session; its messages cascade-delete via the FK. */
  async deleteAdvisorSession(userId: UserId, sessionId: string): Promise<void> {
    const { error } = await this.db.from("chat_sessions").delete().eq("id", sessionId).eq("user_id", userId);
    if (error) throw error;
  }
}

function toSavedRoadmap(row: {
  id: string;
  target_role: string;
  content: unknown;
  total_estimated_weeks: number;
  progress: unknown;
  created_at: string;
}): SavedRoadmap {
  return {
    id: row.id,
    targetRole: row.target_role,
    roadmap: row.content as LearningRoadmap,
    totalEstimatedWeeks: row.total_estimated_weeks,
    progress: (row.progress ?? {}) as SavedRoadmap["progress"],
    createdAt: row.created_at,
  };
}
