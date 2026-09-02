"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StudyEntityType } from "@/lib/study-hub/types";
import { studyHubApi } from "./api";

const KEYS = {
  bookmarks: (t?: StudyEntityType) => ["study-hub", "bookmarks", t ?? "all"],
  recentlyViewed: (t?: StudyEntityType) => ["study-hub", "recent", t ?? "all"],
  sessions: () => ["study-hub", "sessions"],
  decks: () => ["study-hub", "decks"],
  quizHistory: () => ["study-hub", "quiz-history"],
};

export function useBookmarks(entityType?: StudyEntityType) {
  return useQuery({
    queryKey: KEYS.bookmarks(entityType),
    queryFn: () => studyHubApi.listBookmarks(entityType),
    staleTime: 30_000,
  });
}

export function useRemoveBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: StudyEntityType; entityId: string }) =>
      studyHubApi.removeBookmark(entityType, entityId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["study-hub", "bookmarks"] }),
  });
}

export function useRecentlyViewed(entityType?: StudyEntityType, limit = 20) {
  return useQuery({
    queryKey: KEYS.recentlyViewed(entityType),
    queryFn: () => studyHubApi.listRecentlyViewed(entityType, limit),
    staleTime: 15_000,
  });
}

export function useStudySessions() {
  return useQuery({
    queryKey: KEYS.sessions(),
    queryFn: () => studyHubApi.getSessionsOverview(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subject?: string) => studyHubApi.startSession(subject),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.sessions() }),
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, notes }: { sessionId: string; notes?: string }) => studyHubApi.endSession(sessionId, notes),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.sessions() }),
  });
}

export function useFlashcardDecks() {
  return useQuery({
    queryKey: KEYS.decks(),
    queryFn: () => studyHubApi.listFlashcardDecks(),
    staleTime: 60_000,
  });
}

export function useQuizHistory() {
  return useQuery({
    queryKey: KEYS.quizHistory(),
    queryFn: () => studyHubApi.listQuizHistory(),
    staleTime: 60_000,
  });
}
