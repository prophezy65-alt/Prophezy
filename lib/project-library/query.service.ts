/**
 * lib/project-library/query.service.ts
 *
 * All reads for the Project Library. This file has no dependency on
 * lib/ai/* anywhere, on purpose — the Project Library is a plain
 * database catalog, not an AI feature. It never calls Gemini, never
 * deducts credits, and never generates content.
 */

import { createClient } from "@/lib/supabase/server";

export interface ProjectLibraryListItem {
  id: string;
  title: string;
  domain: string;
  subdomain: string | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  description: string;
  techStack: string[];
  skills: string[];
  githubUrl: string | null;
  estimatedHoursMin: number | null;
  estimatedHoursMax: number | null;
}

export interface ProjectLibraryDetail extends ProjectLibraryListItem {
  readmeExcerpt: string | null;
  readmeImages: string[];
  problemStatement: string | null;
  solutionOverview: string | null;
  architecture: string | null;
  modules: string[];
  howItIsBuilt: string | null;
  developmentSteps: string[];
  prerequisites: string[];
  expectedOutput: string | null;
  demoUrl: string | null;
  documentationUrl: string | null;
  tutorialUrl: string | null;
  datasetInfo: string | null;
  apiInfo: string | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  source: string;
  sourceUrl: string | null;
}

export interface ProjectLibraryFilters {
  search?: string;
  domain?: string;
  subdomain?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  techStack?: string[]; // matches ANY of the given values
  skills?: string[]; // matches ANY of the given values
  maxEstimatedHours?: number;
  page?: number; // 1-indexed
  pageSize?: number; // capped at 50
}

export interface ProjectLibraryPage {
  items: ProjectLibraryListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function toListItem(row: Record<string, unknown>): ProjectLibraryListItem {
  return {
    id: row.id as string,
    title: row.title as string,
    domain: row.domain as string,
    subdomain: (row.subdomain as string | null) ?? null,
    difficulty: row.difficulty as ProjectLibraryListItem["difficulty"],
    description: row.description as string,
    techStack: (row.tech_stack as string[] | null) ?? [],
    skills: (row.skills as string[] | null) ?? [],
    githubUrl: (row.github_url as string | null) ?? null,
    estimatedHoursMin: (row.estimated_hours_min as number | null) ?? null,
    estimatedHoursMax: (row.estimated_hours_max as number | null) ?? null,
  };
}

/**
 * Lists real, stored projects with database-backed search, filtering, and
 * pagination. Never loads the full 1000+ row table into memory — every
 * filter is applied as a Postgres query via Supabase, and results are
 * paged server-side.
 */
export async function listProjects(filters: ProjectLibraryFilters): Promise<ProjectLibraryPage> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("project_library")
    .select(
      "id, title, domain, subdomain, difficulty, description, tech_stack, skills, github_url, estimated_hours_min, estimated_hours_max",
      { count: "exact" }
    )
    .eq("is_published", true);

  if (filters.search && filters.search.trim().length > 0) {
    // websearch_to_tsquery handles free-text input (quotes, "or", etc.)
    // more gracefully than plainto_tsquery for a real search box.
    query = query.textSearch("search_vector", filters.search.trim(), { type: "websearch", config: "english" });
  }
  if (filters.domain) query = query.eq("domain", filters.domain);
  if (filters.subdomain) query = query.eq("subdomain", filters.subdomain);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.techStack && filters.techStack.length > 0) query = query.overlaps("tech_stack", filters.techStack);
  if (filters.skills && filters.skills.length > 0) query = query.overlaps("skills", filters.skills);
  if (typeof filters.maxEstimatedHours === "number") query = query.lte("estimated_hours_min", filters.maxEstimatedHours);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new Error(`project_library query failed: ${error.message}`);

  const totalCount = count ?? 0;
  const items = (data ?? []).map(toListItem);

  // This should never legitimately happen (count and items come from the
  // same filtered query), so if it does, log everything needed to
  // actually diagnose it next time instead of silently returning a
  // contradictory result.
  if (totalCount > 0 && items.length === 0) {
    console.error("[project_library] count/items mismatch", {
      filters,
      page,
      pageSize,
      from,
      to,
      totalCount,
      dataLength: data?.length ?? null,
      rawData: data,
    });
  }

  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

/** Fetches one project's full stored detail by id. No AI enrichment — if a field wasn't imported, it comes back null and the UI shows "Not provided". */
export async function getProjectById(id: string): Promise<ProjectLibraryDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_library").select("*").eq("id", id).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`project_library detail query failed: ${error.message}`);
  if (!data) return null;

  return {
    ...toListItem(data),
    readmeExcerpt: data.readme_excerpt ?? null,
    readmeImages: data.readme_images ?? [],
    problemStatement: data.problem_statement ?? null,
    solutionOverview: data.solution_overview ?? null,
    architecture: data.architecture ?? null,
    modules: data.modules ?? [],
    howItIsBuilt: data.how_it_is_built ?? null,
    developmentSteps: data.development_steps ?? [],
    prerequisites: data.prerequisites ?? [],
    expectedOutput: data.expected_output ?? null,
    demoUrl: data.demo_url ?? null,
    documentationUrl: data.documentation_url ?? null,
    tutorialUrl: data.tutorial_url ?? null,
    datasetInfo: data.dataset_info ?? null,
    apiInfo: data.api_info ?? null,
    teamSizeMin: data.team_size_min ?? null,
    teamSizeMax: data.team_size_max ?? null,
    source: data.source,
    sourceUrl: data.source_url ?? null,
  };
}

/** Distinct domain/subdomain values currently in the table, for building filter dropdowns from real data instead of a hardcoded list. */
export async function listFilterOptions(): Promise<{ domains: string[]; difficulties: string[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_library").select("domain, difficulty").eq("is_published", true);
  if (error) throw new Error(`project_library filter-options query failed: ${error.message}`);
  const domains = Array.from(new Set((data ?? []).map((r) => r.domain))).sort();
  const difficulties = Array.from(new Set((data ?? []).map((r) => r.difficulty))).sort();
  return { domains, difficulties };
}
