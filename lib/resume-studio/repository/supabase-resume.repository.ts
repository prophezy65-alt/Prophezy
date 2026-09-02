/**
 * supabase-resume.repository.ts
 *
 * Implements the `ResumeRepository` interface from
 * `lib/resume-studio/services/resume.service.ts` against the real Supabase
 * schema (`public.resumes` / `public.resume_versions`, extended by
 * `supabase/migrations/0035_resume_studio_extend.sql`).
 *
 * This is the only file that knows about the DB row shape — everything else
 * in lib/resume-studio/ works purely with the domain types in
 * `models/resume.model.ts`. Row <-> domain mapping happens here so the rest
 * of the module never has to think about snake_case columns or `Json`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { ResumeRepository } from "../services/resume.service";
import type {
  Resume,
  ResumeContent,
  ResumeVersion,
  ResumeId,
  UserId,
} from "../models/resume.model";

type TypedSupabaseClient = SupabaseClient<Database>;
type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type ResumeVersionRow = Database["public"]["Tables"]["resume_versions"]["Row"];

function rowToResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    // `template` is stored as free-form text in the DB (it predates the
    // TemplateId union), so we assert it here rather than widening the
    // domain type — every write path in this repository only ever writes a
    // valid TemplateId, so this is safe in practice.
    templateId: row.template as Resume["templateId"],
    content: row.content as unknown as ResumeContent,
    targetRole: row.target_role ?? undefined,
    targetJobDescription: row.target_job_description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentVersion: row.current_version,
  };
}

function rowToVersion(row: ResumeVersionRow): ResumeVersion {
  return {
    id: row.id,
    resumeId: row.resume_id,
    version: row.version,
    content: row.content as unknown as ResumeContent,
    label: row.label ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by,
    changeSummary: row.change_summary ?? undefined,
  };
}

export function createSupabaseResumeRepository(
  supabase: TypedSupabaseClient
): ResumeRepository {
  return {
    async getResume(id: ResumeId): Promise<Resume | null> {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToResume(data) : null;
    },

    async listResumesForUser(userId: UserId): Promise<Resume[]> {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToResume);
    },

    async saveResume(resume: Resume): Promise<Resume> {
      const { data, error } = await supabase
        .from("resumes")
        .upsert(
          {
            id: resume.id,
            user_id: resume.userId,
            title: resume.title,
            template: resume.templateId,
            content: resume.content as unknown as Json,
            target_role: resume.targetRole ?? null,
            target_job_description: resume.targetJobDescription ?? null,
            current_version: resume.currentVersion,
            created_at: resume.createdAt,
            updated_at: resume.updatedAt,
          },
          { onConflict: "id" }
        )
        .select("*")
        .single();
      if (error) throw error;
      return rowToResume(data);
    },

    async deleteResume(id: ResumeId): Promise<void> {
      const { error } = await supabase.from("resumes").delete().eq("id", id);
      if (error) throw error;
    },

    async saveVersion(version: ResumeVersion): Promise<ResumeVersion> {
      const { data, error } = await supabase
        .from("resume_versions")
        .insert({
          id: version.id,
          resume_id: version.resumeId,
          version: version.version,
          content: version.content as unknown as Json,
          label: version.label ?? null,
          created_at: version.createdAt,
          created_by: version.createdBy,
          change_summary: version.changeSummary ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return rowToVersion(data);
    },

    async listVersions(resumeId: ResumeId): Promise<ResumeVersion[]> {
      const { data, error } = await supabase
        .from("resume_versions")
        .select("*")
        .eq("resume_id", resumeId)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToVersion);
    },

    async getVersion(resumeId: ResumeId, version: number): Promise<ResumeVersion | null> {
      const { data, error } = await supabase
        .from("resume_versions")
        .select("*")
        .eq("resume_id", resumeId)
        .eq("version", version)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToVersion(data) : null;
    },
  };
}
