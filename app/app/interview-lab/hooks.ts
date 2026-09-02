/**
 * app/app/interview-lab/hooks.ts
 *
 * React Query hooks over the typed api.ts client. Query keys are namespaced
 * under "interview" so mutations can invalidate precisely.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { StartSessionForm } from "./types";

const keys = {
  sessions: ["interview", "sessions"] as const,
  analytics: ["interview", "analytics"] as const,
  session: (id: string) => ["interview", "session", id] as const,
};

export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: api.listSessions });
}

export function useAnalytics() {
  return useQuery({ queryKey: keys.analytics, queryFn: api.getAnalytics });
}

export function useSessionDetail(id: string | null) {
  return useQuery({
    queryKey: keys.session(id ?? "none"),
    queryFn: () => api.getSessionDetail(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: StartSessionForm) => api.createSession(form),
    retry: 1,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.sessions });
    },
  });
}

export function useCreateSessionFromDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ form, file }: { form: StartSessionForm; file: File }) =>
      api.createSessionFromDocument(form, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.sessions });
    },
  });
}

// Transient failures (network blips, upstream 5xx) are worth one retry; a
// client error like a 409 "already answered", auth, or validation failure is
// not — retrying just repeats the same failure.
function isRetriable(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return !/already been answered|signed in|invalid|not found|closed/.test(message);
}

export function useSubmitAnswer(sessionId: string) {
  return useMutation({
    mutationFn: ({ questionId, answerText }: { questionId: string; answerText: string }) =>
      api.submitAnswer(sessionId, questionId, answerText),
    retry: (failureCount, error) => failureCount < 1 && isRetriable(error),
    retryDelay: 800,
  });
}

export function useCompleteSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: "completed" | "abandoned") => api.completeSession(sessionId, status),
    retry: 1,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.sessions });
      void qc.invalidateQueries({ queryKey: keys.analytics });
      void qc.invalidateQueries({ queryKey: keys.session(sessionId) });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.sessions });
      void qc.invalidateQueries({ queryKey: keys.analytics });
    },
  });
}

export function useCompanyLookup() {
  return useMutation({
    mutationFn: ({ company, role }: { company: string; role?: string }) =>
      api.lookupCompany(company, role),
  });
}
