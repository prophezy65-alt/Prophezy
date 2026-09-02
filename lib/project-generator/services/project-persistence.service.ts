/**
 * lib/project-generator/services/project-persistence.service.ts
 *
 * The ONLY file that talks to Supabase for saved Project Generator
 * projects. API routes call this instead of using `createClient()`
 * directly, matching the pattern already used by
 * lib/flashcards/services/flashcards.service.ts.
 *
 * `project_generator_projects` / `project_generator_milestones` now exist
 * in the live database (migrations/0001_project_generator_projects.sql)
 * and in the generated `lib/supabase/types.ts`. JSONB columns (spec,
 * database_schema, api_design, roadmap, diagrams, deployment_plan,
 * testing_plan, security_plan, estimation) are typed `Json` by the
 * generator, which is stricter than our domain interfaces (they have no
 * index signature), so writes go through `as unknown as Json` — the data
 * itself is unchanged, this only satisfies TypeScript.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import type {
  ProjectSpec,
  DatabaseSchema,
  ApiDesign,
  Roadmap,
  DiagramSet,
  DeploymentPlan,
  TestingPlan,
  SecurityPlan,
  ProjectEstimation,
} from "../models";

export type SavedProjectStatus = "draft" | "generating" | "ready" | "failed";

/** Mirrors the `project_generator_projects` row shape. */
export interface SavedProjectRow {
  id: string;
  user_id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  domains: string[];
  difficulty_score: number | null;
  complexity_score: number | null;
  scale: string | null;
  status: SavedProjectStatus;
  error_message: string | null;
  spec: ProjectSpec | null;
  database_schema: DatabaseSchema | null;
  api_design: ApiDesign | null;
  roadmap: Roadmap | null;
  diagrams: DiagramSet | null;
  deployment_plan: DeploymentPlan | null;
  testing_plan: TestingPlan | null;
  security_plan: SecurityPlan | null;
  estimation: ProjectEstimation | null;
  export_bundle_path: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  progress_percent: number;
  github_repo_url: string | null;
  demo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListProjectsFilters {
  readonly search?: string;
  readonly domain?: string;
  readonly status?: SavedProjectStatus;
  readonly favoriteOnly?: boolean;
  readonly archivedOnly?: boolean;
  readonly limit?: number;
  readonly cursor?: string; // created_at of the last row from the previous page
}

export interface ProjectEditableFields {
  readonly title?: string;
  readonly description?: string;
  readonly githubRepoUrl?: string | null;
  readonly demoUrl?: string | null;
  readonly progressPercent?: number;
}

function toError(context: string, error: { message: string } | null): Error {
  return new Error(`ProjectPersistenceService.${context} failed: ${error?.message ?? "unknown error"}`);
}

export const projectPersistenceService = {
  /** Creates the initial "generating" row before the AI pipeline runs, so progress is visible immediately. */
  async createDraft(input: { userId: string; title: string; domains: string[] }): Promise<SavedProjectRow> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_generator_projects")
      .insert({
        user_id: input.userId,
        title: input.title,
        domains: input.domains,
        status: "generating",
      })
      .select()
      .single();

    if (error || !data) throw toError("createDraft", error);
    return data as SavedProjectRow;
  },

  /** Writes every generated artifact once the pipeline completes successfully. */
  async saveGeneratedResult(
    projectId: string,
    result: {
      spec: ProjectSpec;
      databaseSchema: DatabaseSchema;
      apiDesign: ApiDesign;
      roadmap: Roadmap;
      diagrams: DiagramSet;
      deploymentPlan: DeploymentPlan;
      testingPlan: TestingPlan;
      securityPlan: SecurityPlan;
      estimation: ProjectEstimation;
      exportBundlePath: string | null;
    }
  ): Promise<SavedProjectRow> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_generator_projects")
      .update({
        status: "ready",
        error_message: null,
        title: result.spec.title,
        tagline: result.spec.tagline,
        description: result.spec.description,
        domains: [...result.spec.domains],
        difficulty_score: result.spec.difficulty.score,
        complexity_score: result.spec.complexity.score,
        scale: result.spec.scale,
        spec: result.spec as unknown as Json,
        database_schema: result.databaseSchema as unknown as Json,
        api_design: result.apiDesign as unknown as Json,
        roadmap: result.roadmap as unknown as Json,
        diagrams: result.diagrams as unknown as Json,
        deployment_plan: result.deploymentPlan as unknown as Json,
        testing_plan: result.testingPlan as unknown as Json,
        security_plan: result.securityPlan as unknown as Json,
        estimation: result.estimation as unknown as Json,
        export_bundle_path: result.exportBundlePath,
      })
      .eq("id", projectId)
      .select()
      .single();

    if (error || !data) throw toError("saveGeneratedResult", error);
    return data as SavedProjectRow;
  },

  /** Marks a project as failed with the real error message, keeping the row visible/debuggable rather than deleting it. */
  async markFailed(projectId: string, errorMessage: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("project_generator_projects")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", projectId);

    if (error) throw toError("markFailed", error);
  },

  async getById(projectId: string, userId: string): Promise<SavedProjectRow | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_generator_projects")
      .select()
      .eq("id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw toError("getById", error);
    return data as SavedProjectRow | null;
  },

  async list(userId: string, filters: ListProjectsFilters): Promise<SavedProjectRow[]> {
    const supabase = await createClient();
    let query = supabase
      .from("project_generator_projects")
      .select()
      .eq("user_id", userId)
      .eq("is_archived", filters.archivedOnly ?? false)
      .order("created_at", { ascending: false })
      .limit(filters.limit ?? 20);

    if (filters.search) {
      query = query.ilike("title", `%${filters.search}%`);
    }
    if (filters.domain) {
      query = query.contains("domains", [filters.domain]);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.favoriteOnly) {
      query = query.eq("is_favorite", true);
    }
    if (filters.cursor) {
      query = query.lt("created_at", filters.cursor);
    }

    const { data, error } = await query;
    if (error) throw toError("list", error);
    return (data ?? []) as SavedProjectRow[];
  },

  async update(projectId: string, userId: string, patch: ProjectEditableFields): Promise<SavedProjectRow> {
    const supabase = await createClient();
    const dbPatch: Database["public"]["Tables"]["project_generator_projects"]["Update"] = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.githubRepoUrl !== undefined) dbPatch.github_repo_url = patch.githubRepoUrl;
    if (patch.demoUrl !== undefined) dbPatch.demo_url = patch.demoUrl;
    if (patch.progressPercent !== undefined) dbPatch.progress_percent = patch.progressPercent;

    const { data, error } = await supabase
      .from("project_generator_projects")
      .update(dbPatch)
      .eq("id", projectId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) throw toError("update", error);
    return data as SavedProjectRow;
  },

  async setFavorite(projectId: string, userId: string, isFavorite: boolean): Promise<SavedProjectRow> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_generator_projects")
      .update({ is_favorite: isFavorite })
      .eq("id", projectId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) throw toError("setFavorite", error);
    return data as SavedProjectRow;
  },

  async setArchived(projectId: string, userId: string, isArchived: boolean): Promise<SavedProjectRow> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_generator_projects")
      .update({ is_archived: isArchived })
      .eq("id", projectId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) throw toError("setArchived", error);
    return data as SavedProjectRow;
  },

  async delete(projectId: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("project_generator_projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", userId);

    if (error) throw toError("delete", error);
  },

  /** Creates a copy of an existing project's generated content as a new, independent, ready-status project. */
  async duplicate(projectId: string, userId: string): Promise<SavedProjectRow> {
    const existing = await this.getById(projectId, userId);
    if (!existing) throw new Error("ProjectPersistenceService.duplicate: source project not found.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_generator_projects")
      .insert({
        user_id: userId,
        title: `${existing.title} (copy)`,
        tagline: existing.tagline,
        description: existing.description,
        domains: existing.domains,
        difficulty_score: existing.difficulty_score,
        complexity_score: existing.complexity_score,
        scale: existing.scale,
        status: existing.status,
        spec: existing.spec as unknown as Json,
        database_schema: existing.database_schema as unknown as Json,
        api_design: existing.api_design as unknown as Json,
        roadmap: existing.roadmap as unknown as Json,
        diagrams: existing.diagrams as unknown as Json,
        deployment_plan: existing.deployment_plan as unknown as Json,
        testing_plan: existing.testing_plan as unknown as Json,
        security_plan: existing.security_plan as unknown as Json,
        estimation: existing.estimation as unknown as Json,
        // Intentionally NOT copied: export_bundle_path (belongs to the
        // original's storage object), github_repo_url, demo_url, favorite,
        // archived, progress — a duplicate starts as a fresh, un-favorited
        // draft-of-a-copy, not a clone of the original's tracked state.
      })
      .select()
      .single();

    if (error || !data) throw toError("duplicate", error);
    return data as SavedProjectRow;
  },

  async listMilestoneCompletion(projectId: string): Promise<Record<string, boolean>> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_generator_milestones")
      .select("task_id, completed")
      .eq("project_id", projectId);

    if (error) throw toError("listMilestoneCompletion", error);
    const map: Record<string, boolean> = {};
    for (const row of (data ?? []) as { task_id: string; completed: boolean }[]) {
      map[row.task_id] = row.completed;
    }
    return map;
  },

  async setMilestoneCompletion(projectId: string, taskId: string, completed: boolean): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("project_generator_milestones").upsert(
      {
        project_id: projectId,
        task_id: taskId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: "project_id,task_id" }
    );

    if (error) throw toError("setMilestoneCompletion", error);
  },
};
