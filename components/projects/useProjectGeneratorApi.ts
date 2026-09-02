"use client";

/**
 * components/projects/useProjectGeneratorApi.ts
 *
 * Thin React Query wrappers around /api/project-generator/projects/*,
 * same apiFetch()-unwrapping pattern as components/flashcards/useFlashcardsApi.ts.
 *
 * NOTE ON FIELD CASING: unlike Flashcards (which maps DB snake_case rows to
 * camelCase domain objects via rowToDeck()), the Project Generator backend's
 * project-persistence.service.ts currently returns the raw DB row shape
 * (snake_case: difficulty_score, is_favorite, progress_percent, etc.)
 * directly in API responses. This file's `SavedProject` type matches that
 * real shape rather than guessing a camelCase one that doesn't exist yet.
 * If you later add a rowToProject()-style mapper for consistency with
 * Flashcards, update this type and the field accesses in ProjectCard.tsx /
 * the projects page together.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface SavedProject {
  id: string;
  user_id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  domains: string[];
  difficulty_score: number | null;
  complexity_score: number | null;
  scale: string | null;
  status: "draft" | "generating" | "ready" | "failed";
  error_message: string | null;
  spec: unknown;
  database_schema: unknown;
  api_design: unknown;
  roadmap: { tasks: { id: string; title: string }[]; phases: unknown[] } | null;
  diagrams: unknown;
  deployment_plan: unknown;
  testing_plan: unknown;
  security_plan: unknown;
  estimation: unknown;
  export_bundle_path: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  progress_percent: number;
  github_repo_url: string | null;
  demo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiError {
  code: string;
  message: string;
  issues?: unknown;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body = await res.json();
  if (!body.ok) {
    const error: ApiError = body.error;
    throw new Error(error.message ?? "Request failed.");
  }
  return body.data as T;
}

const keys = {
  projects: (filters?: ProjectListFilters) => ["project-generator", "projects", filters ?? {}] as const,
  project: (id: string) => ["project-generator", "project", id] as const,
};

export interface ProjectListFilters {
  search?: string;
  domain?: string;
  status?: SavedProject["status"];
  favorite?: boolean;
  archived?: boolean;
}

function buildListUrl(filters?: ProjectListFilters): string {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.domain) params.set("domain", filters.domain);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.favorite) params.set("favorite", "true");
  if (filters?.archived) params.set("archived", "true");
  const qs = params.toString();
  return `/api/project-generator/projects${qs ? `?${qs}` : ""}`;
}

export function useProjects(filters?: ProjectListFilters) {
  return useQuery({
    queryKey: keys.projects(filters),
    queryFn: () => apiFetch<{ projects: SavedProject[] }>(buildListUrl(filters)),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.project(projectId ?? ""),
    queryFn: () =>
      apiFetch<{ project: SavedProject; milestoneCompletion: Record<string, boolean> }>(
        `/api/project-generator/projects/${projectId}`
      ),
    enabled: !!projectId,
  });
}

export interface GenerateProjectParams {
  idea: string;
  title?: string;
  preferredDomains?: string[];
  targetDifficulty?: string;
  targetScale?: string;
  maxModules?: number;
}

export function useGenerateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: GenerateProjectParams) =>
      apiFetch<{ project: SavedProject }>("/api/project-generator/projects", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-generator", "projects"] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => apiFetch(`/api/project-generator/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-generator", "projects"] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      ...body
    }: {
      projectId: string;
      title?: string;
      description?: string;
      githubRepoUrl?: string | null;
      demoUrl?: string | null;
      progressPercent?: number;
    }) =>
      apiFetch<{ project: SavedProject }>(`/api/project-generator/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-generator", "projects"] });
      queryClient.invalidateQueries({ queryKey: keys.project(variables.projectId) });
    },
  });
}

export function useFavoriteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, favorite }: { projectId: string; favorite: boolean }) =>
      apiFetch<{ project: SavedProject }>(`/api/project-generator/projects/${projectId}/favorite`, {
        method: "POST",
        body: JSON.stringify({ favorite }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-generator", "projects"] }),
  });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, archived }: { projectId: string; archived: boolean }) =>
      apiFetch<{ project: SavedProject }>(`/api/project-generator/projects/${projectId}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-generator", "projects"] }),
  });
}

export function useDuplicateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<{ project: SavedProject }>(`/api/project-generator/projects/${projectId}/duplicate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-generator", "projects"] }),
  });
}

export function useToggleMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      apiFetch<{ project: SavedProject; milestoneCompletion: Record<string, boolean> }>(
        `/api/project-generator/projects/${projectId}/milestones`,
        { method: "PATCH", body: JSON.stringify({ taskId, completed }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ["project-generator", "projects"] });
    },
  });
}
