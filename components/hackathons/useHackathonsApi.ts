"use client";

/**
 * components/hackathons/useHackathonsApi.ts
 *
 * React Query wrappers around every /api/hackathons/* route. Every route
 * returns either the raw data directly or { error: string } on failure
 * (lib/hackathons/http/response.ts) — same convention as the flashcards/
 * notes modules' hooks files.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Hackathon,
  HackathonFilters,
  CursorPage,
  HackathonTrackingEntry,
  HackathonRecommendation,
  HackathonNotification,
  SearchResultItem,
  TrackingStatus,
} from "@/lib/hackathons/models/hackathon.model";
import type { HackathonSort } from "@/lib/hackathons/services/hackathon.service";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && typeof body === "object" && "error" in body ? (body as { error: string }).error : null) ?? `Request failed (${res.status})`);
  }
  return body as T;
}

function buildQuery(filters: HackathonFilters, sort: HackathonSort, extra: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  if (filters.country) params.set("country", filters.country);
  if (filters.mode?.length) params.set("mode", filters.mode.join(","));
  if (filters.experienceTier?.length) params.set("experienceTier", filters.experienceTier.join(","));
  if (filters.eligibility?.length) params.set("eligibility", filters.eligibility.join(","));
  if (filters.minPrizePoolUsd) params.set("minPrizePoolUsd", String(filters.minPrizePoolUsd));
  if (filters.technologies?.length) params.set("technologies", filters.technologies.join(","));
  if (filters.themes?.length) params.set("themes", filters.themes.join(","));
  if (filters.registrationDeadlineBefore) params.set("registrationDeadlineBefore", filters.registrationDeadlineBefore);
  if (filters.submissionDeadlineBefore) params.set("submissionDeadlineBefore", filters.submissionDeadlineBefore);
  params.set("sort", sort);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return params;
}

const keys = {
  list: (filters: HackathonFilters, sort: HackathonSort) => ["hackathons", "list", filters, sort] as const,
  detail: (id: string) => ["hackathons", "detail", id] as const,
  tracking: (status?: string) => ["hackathons", "tracking", status ?? "all"] as const,
  recommendations: ["hackathons", "recommendations"] as const,
  notifications: ["hackathons", "notifications"] as const,
  search: (q: string) => ["hackathons", "search", q] as const,
};

// ---- listing (cursor-paginated) ------------------------------------------

export function useHackathonsList(filters: HackathonFilters, sort: HackathonSort) {
  return useInfiniteQuery({
    queryKey: keys.list(filters, sort),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiFetch<CursorPage<Hackathon>>(`/api/hackathons?${buildQuery(filters, sort, { cursor: pageParam }).toString()}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
  });
}

export function useHackathon(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ""),
    queryFn: () => apiFetch<Hackathon>(`/api/hackathons/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });
}

// ---- search (lightweight results -> hydrated with full details) ---------

export function useHackathonSearch(query: string) {
  return useQuery({
    queryKey: keys.search(query),
    queryFn: async () => {
      const results = await apiFetch<SearchResultItem[]>(`/api/hackathons/search?q=${encodeURIComponent(query)}`);
      const hydrated = await Promise.all(
        results.map(async (r) => {
          try {
            const hackathon = await apiFetch<Hackathon>(`/api/hackathons/${encodeURIComponent(r.id)}`);
            return { result: r, hackathon };
          } catch {
            return { result: r, hackathon: null };
          }
        })
      );
      return hydrated.filter((h) => h.hackathon !== null) as { result: SearchResultItem; hackathon: Hackathon }[];
    },
    enabled: query.trim().length > 0,
  });
}

// ---- tracking (save/unsave, register, progress) --------------------------

export interface TrackedHackathon {
  entry: HackathonTrackingEntry;
  hackathon: Hackathon;
}

export function useTrackedHackathons(status?: TrackingStatus) {
  return useQuery({
    queryKey: keys.tracking(status),
    queryFn: () => apiFetch<TrackedHackathon[]>(`/api/hackathons/tracking${status ? `?status=${status}` : ""}`),
  });
}

function invalidateHackathonState(queryClient: ReturnType<typeof useQueryClient>, hackathonId: string) {
  queryClient.invalidateQueries({ queryKey: ["hackathons", "tracking"] });
  queryClient.invalidateQueries({ queryKey: keys.detail(hackathonId) });
  queryClient.invalidateQueries({ queryKey: keys.recommendations });
}

export function useSaveHackathon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hackathonId: string) =>
      apiFetch<HackathonTrackingEntry>(`/api/hackathons/${encodeURIComponent(hackathonId)}/save`, { method: "POST" }),
    onSuccess: (_data, hackathonId) => invalidateHackathonState(queryClient, hackathonId),
  });
}

export function useUnsaveHackathon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hackathonId: string) => apiFetch(`/api/hackathons/${encodeURIComponent(hackathonId)}/save`, { method: "DELETE" }),
    onSuccess: (_data, hackathonId) => invalidateHackathonState(queryClient, hackathonId),
  });
}

export function useUpdateTrackingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hackathonId, status, notes }: { hackathonId: string; status: TrackingStatus; notes?: string }) =>
      apiFetch<HackathonTrackingEntry>(`/api/hackathons/${encodeURIComponent(hackathonId)}/tracking`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: (_data, variables) => invalidateHackathonState(queryClient, variables.hackathonId),
  });
}

// ---- recommendations + notifications -------------------------------------

export function useHackathonRecommendations(limit = 8) {
  return useQuery({
    queryKey: keys.recommendations,
    queryFn: () => apiFetch<HackathonRecommendation[]>(`/api/hackathons/recommendations?limit=${limit}`),
  });
}

export function useHackathonNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => apiFetch<HackathonNotification[]>("/api/hackathons/notifications"),
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch(`/api/hackathons/notifications/${encodeURIComponent(notificationId)}`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.notifications }),
  });
}
