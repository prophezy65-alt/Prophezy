"use client";

/**
 * app/projects/useProjectLibraryApi.ts
 *
 * Talks only to /api/project-library/*, which is a plain Supabase read
 * path — there is no AI generation call anywhere in this file or the
 * routes it hits, and browsing/searching/filtering/opening a project
 * never deducts credits.
 */

import { useCallback, useEffect, useState } from "react";

export interface LibraryProjectListItem {
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

export interface LibraryProjectDetail extends LibraryProjectListItem {
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

export interface LibraryFilters {
  search: string;
  domain: string | null;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function buildQuery(filters: LibraryFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  params.set("page", String(page));
  return params.toString();
}

export function useProjectLibrary(filters: LibraryFilters, page: number) {
  const [items, setItems] = useState<LibraryProjectListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(retriesLeft: number) {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/project-library?${buildQuery(filters, page)}`);
        const body = (await res.json()) as ApiEnvelope<{ items: LibraryProjectListItem[]; totalPages: number; totalCount: number }>;
        if (cancelled) return;
        if (!body.ok || !body.data) {
          setError(body.error?.message ?? "Failed to load projects.");
          return;
        }
        // Self-healing guard: totalCount and items should always agree
        // (they come from the same filtered query). If they don't --
        // whatever the cause, transient or otherwise -- retry once
        // instead of immediately showing the contradiction. But if the
        // SAME mismatch survives the retry too, that means it's not
        // transient -- show a real, honest error instead of silently
        // rendering "N found" next to an empty grid forever.
        if (body.data.totalCount > 0 && body.data.items.length === 0) {
          if (retriesLeft > 0) {
            await load(retriesLeft - 1);
            return;
          }
          setError(`Found ${body.data.totalCount} matching projects, but couldn't actually load them. Try refreshing, or a different filter.`);
          return;
        }
        setItems(body.data.items);
        setTotalPages(body.data.totalPages);
        setTotalCount(body.data.totalCount);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load projects.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load(1);

    return () => {
      cancelled = true;
    };
  }, [filters.search, filters.domain, filters.difficulty, page]);

  return { items, totalPages, totalCount, isLoading, error };
}

export function useProjectLibraryFilterOptions() {
  const [domains, setDomains] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/project-library/filters")
      .then((res) => res.json() as Promise<ApiEnvelope<{ domains: string[] }>>)
      .then((body) => {
        if (body.ok && body.data) setDomains(body.data.domains);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { domains, isLoading };
}

export function useProjectLibraryDetail(id: string | null) {
  const [project, setProject] = useState<LibraryProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/project-library/${id}`)
      .then((res) => res.json() as Promise<ApiEnvelope<LibraryProjectDetail>>)
      .then((body) => {
        if (!body.ok || !body.data) {
          setError(body.error?.message ?? "Project not found.");
          return;
        }
        setProject(body.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project."))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { project, isLoading, error, reload: load };
}
