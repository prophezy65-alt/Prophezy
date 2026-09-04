"use client";

import { useMemo } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import type { SearchRequest, ApplicationStatus, ApplicationDocumentRef } from "@/lib/internships/types";
import { internshipsApi, InternshipApiError, type UnlockStatus, type UnlockedInternshipEntry } from "./api";
import { useToast } from "@/components/providers/toast-provider";

const KEYS = {
  search: (req: Omit<SearchRequest, "cursor">) => ["internships", "search", req] as QueryKey,
  detail: (id: string) => ["internships", "detail", id] as QueryKey,
  saved: () => ["internships", "saved"] as QueryKey,
  recentlyViewed: () => ["internships", "recently-viewed"] as QueryKey,
  applications: (status?: ApplicationStatus) => ["internships", "applications", status ?? "all"] as QueryKey,
  recommendations: (limit: number) => ["internships", "recommendations", limit] as QueryKey,
  notifications: (unreadOnly: boolean) => ["internships", "notifications", unreadOnly] as QueryKey,
  /** Client-side-only "have I unlocked this internship's real applyUrl in
   * this session" flag — set true the moment a POST /:id/unlock succeeds,
   * or seeded from useUnlockedInternships() on page load. Not persisted
   * itself (that's internship_unlocks, server-side) — this is just the
   * fast in-memory cache every InternshipCard reads from. */
  unlocked: (internshipId: string) => ["internships", "unlocked", internshipId] as QueryKey,
  unlockStatus: () => ["internships", "unlock-status"] as QueryKey,
  unlockedList: () => ["internships", "unlocked-list"] as QueryKey,
};

/** Cursor-paginated / infinite-scroll internship search. */
export function useInternshipSearch(req: Omit<SearchRequest, "cursor">) {
  return useInfiniteQuery({
    queryKey: KEYS.search(req),
    queryFn: ({ pageParam }) => internshipsApi.search({ ...req, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60 * 1000,
  });
}

export function useInternshipDetail(id: string | null) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ""),
    queryFn: () => internshipsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useSavedInternships() {
  return useQuery({
    queryKey: KEYS.saved(),
    queryFn: () => internshipsApi.listSaved(),
    staleTime: 30 * 1000,
  });
}

/** Recorded server-side automatically on every detail-page view — this hook
 *  is read-only, there's no separate "mark as viewed" action to trigger.
 *  `enabled` defaults to true for any caller that doesn't pass it (e.g. a
 *  future consumer that always needs this data); the Opportunities page
 *  passes `tab === "recent"` so this list — used nowhere except that one
 *  tab — isn't fetched on every page load regardless of which tab is
 *  actually open. */
export function useRecentlyViewed(limit = 30, enabled = true) {
  return useQuery({
    queryKey: KEYS.recentlyViewed(),
    queryFn: () => internshipsApi.listRecentlyViewed(limit),
    staleTime: 15 * 1000,
    enabled,
  });
}

/** True while `internshipId` is in the current saved list — cheap to derive,
 *  avoids every card needing its own network request just to know its state. */
export function useIsSaved(internshipId: string): boolean {
  const { data } = useSavedInternships();
  return useMemo(() => (data ?? []).some((item) => item.id === internshipId), [data, internshipId]);
}

export function useToggleSaved() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ internshipId, isSaved }: { internshipId: string; isSaved: boolean }) => {
      if (isSaved) {
        await internshipsApi.unsave(internshipId);
      } else {
        await internshipsApi.save(internshipId);
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: KEYS.saved() });
      void queryClient.invalidateQueries({ queryKey: KEYS.applications() });
      toast.success(variables.isSaved ? "Removed from saved." : "Saved.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof InternshipApiError ? error.message : "Couldn't update saved status.");
    },
  });
}

/**
 * The real applyUrl for this internship once unlocked in the current
 * session (see KEYS.unlocked), or null if not yet unlocked. Storing the
 * URL itself — not just a boolean — matters: it lets a second click on an
 * already-unlocked card just reopen the link for free, instead of calling
 * POST /:id/unlock again and spending a second credit / counting a second
 * time against the plan's monthly cap for something already paid for.
 *
 * This cache entry is seeded two ways: (1) immediately after a successful
 * unlock (see useUnlockApplication), and (2) in bulk on page load from the
 * durable server-side list (see useUnlockedInternships) — so a card shows
 * "Unlocked" correctly even on a fresh page load/session, not just within
 * the same browser tab that did the unlocking.
 */
export function useUnlockedUrl(internshipId: string): string | null {
  const { data } = useQuery({
    queryKey: KEYS.unlocked(internshipId),
    queryFn: () => null as string | null,
    initialData: null as string | null,
    staleTime: Infinity,
  });
  return data ?? null;
}

/**
 * How many internship application unlocks this user has left this period,
 * under their CURRENT plan (Free 5, Pro 25, Premium unlimited). Shared
 * across every card via the query cache — one request, not one per card.
 * `remaining`/`allowance` are `null` for an unlimited plan; render that as
 * "Unlimited", never as 0 or a placeholder number.
 */
export function useUnlockStatus() {
  return useQuery({
    queryKey: KEYS.unlockStatus(),
    queryFn: () => internshipsApi.getUnlockStatus(),
    staleTime: 30 * 1000,
  });
}

/**
 * Every internship this user has ever unlocked — the durable,
 * server-confirmed list (internship_unlocks table), not the in-memory
 * per-card cache from useUnlockedUrl. Also seeds that per-card cache for
 * every entry as soon as this loads, so every InternshipCard's existing
 * "Unlocked" badge/button state is correct immediately on page load —
 * InternshipCard itself needs zero changes to pick this up. Used both to
 * power the dedicated "Unlocked" tab and to keep every card everywhere
 * else in the app correctly marked.
 */
export function useUnlockedInternships() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: KEYS.unlockedList(),
    queryFn: async () => {
      const entries = await internshipsApi.listUnlocked();
      for (const entry of entries) {
        queryClient.setQueryData(KEYS.unlocked(entry.internship.id), entry.applyUrl);
      }
      return entries;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Unlocks and returns the real application link for one internship — the
 * only place applyUrl can be obtained client-side now that search/detail
 * strip it (Phase 5). Spends a credit and counts against the plan's
 * monthly unlock allowance server-side; both kinds of "can't unlock" (out
 * of credits, out of this period's unlocks) come back as a normal
 * InternshipApiError with a message meant to be shown as-is.
 */
export function useUnlockApplication() {
  const toast = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (internshipId: string) => internshipsApi.unlockApplication(internshipId),
    onSuccess: (result, internshipId) => {
      queryClient.setQueryData(KEYS.unlocked(internshipId), result.applyUrl);
      // The response already tells us the fresh remaining count — no need
      // for a second round trip, just seed the shared cache directly.
      queryClient.setQueryData(KEYS.unlockStatus(), (prev: UnlockStatus | undefined) => ({
        allowance: prev?.allowance ?? null,
        remaining: result.unlocksRemaining,
      }));
      // Also invalidate the durable list so the new "Unlocked" tab and any
      // other consumer pick up this fresh unlock on next read, instead of
      // only knowing about it via the single per-card cache entry above.
      void queryClient.invalidateQueries({ queryKey: KEYS.unlockedList() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof InternshipApiError ? error.message : "Couldn't open the application link.");
      // A failed unlock is most often "you're at your period's cap" — the
      // shared unlockStatus cache still holds whatever number it had
      // BEFORE this attempt, so every card (and the banner) would keep
      // showing "Unlock to Apply" / "N left" instead of flipping to
      // "Limit reached — Upgrade" until the next unrelated refetch.
      // Re-pulling the authoritative server count here closes that gap
      // immediately, right when the user just found out they're capped.
      void queryClient.invalidateQueries({ queryKey: KEYS.unlockStatus() });
    },
  });
}

export function useApplications(status?: ApplicationStatus) {
  return useQuery({
    queryKey: KEYS.applications(status),
    queryFn: () => internshipsApi.listApplications(status),
    staleTime: 30 * 1000,
  });
}

export function useTransitionApplication() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (input: {
      internshipId: string;
      status: ApplicationStatus;
      notes?: string;
      interviewAt?: string;
      deadlineAt?: string;
      documents?: ApplicationDocumentRef[];
    }) => internshipsApi.transitionApplication(input.internshipId, input.status, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["internships", "applications"] });
      void queryClient.invalidateQueries({ queryKey: KEYS.saved() });
      toast.success("Application updated.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof InternshipApiError ? error.message : "Couldn't update application.");
    },
  });
}

export function useRecommendations(limit = 20) {
  return useQuery({
    queryKey: KEYS.recommendations(limit),
    queryFn: () => internshipsApi.recommendations(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useInternshipNotifications(unreadOnly = false, limit = 50) {
  return useQuery({
    queryKey: KEYS.notifications(unreadOnly),
    queryFn: () => internshipsApi.listNotifications(unreadOnly, limit),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => internshipsApi.markNotificationsRead(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["internships", "notifications"] });
    },
  });
}