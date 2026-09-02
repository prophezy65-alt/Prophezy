"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./researchApi";
import type { Paper, SearchKind } from "@/lib/research/models/paper.types";

const KEYS = {
  papers: (q?: string) => ["research", "papers", q ?? ""] as const,
  paper: (id: string) => ["research", "paper", id] as const,
  knowledgeGraphs: ["research", "knowledge-graphs"] as const,
  chatSessions: ["research", "chat-sessions"] as const,
  chatMessages: (sessionId: string) => ["research", "chat-messages", sessionId] as const,
};

export function usePapers(search: string) {
  return useQuery({
    queryKey: KEYS.papers(search),
    queryFn: () => api.listPapers({ q: search || undefined }),
  });
}

export function usePaper(id: string | null) {
  return useQuery({
    queryKey: KEYS.paper(id ?? ""),
    queryFn: () => api.getPaper(id as string),
    enabled: Boolean(id),
  });
}

export function useUploadPaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadPaper(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "papers"] });
    },
  });
}

export function useDeletePaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePaper(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "papers"] });
    },
  });
}

export function useSavePaperFromSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paper: Paper) => api.savePaperFromSearch(paper),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "papers"] });
    },
  });
}

export function useGenerateSummary(paperId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (forceRefresh: boolean) => api.generateSummary(paperId, forceRefresh),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.paper(paperId) });
    },
  });
}

export function useExtractCitations(paperId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.extractCitations(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.paper(paperId) });
    },
  });
}

export function useExternalSearch() {
  return useMutation({
    mutationFn: ({ query, kind }: { query: string; kind?: SearchKind }) => api.searchExternalPapers(query, kind),
  });
}

/**
 * REPLACES useTopicOverview(). Topic Explorer is now a real search over the
 * synced paper library (Postgres full-text search, zero Gemini) instead of
 * a Gemini-generated essay — see researchApi.ts's searchTopicExplorer() and
 * lib/research/services/topic-explorer.service.ts. Kept as a mutation
 * (not a query) to match the existing "type a topic, press search" flow —
 * it's user-triggered, not something to auto-fetch on every keystroke.
 */
export function useTopicSearch() {
  return useMutation({
    mutationFn: (opts: { topic: string; limit?: number; offset?: number; topicFilter?: string }) =>
      api.searchTopicExplorer(opts.topic, { limit: opts.limit, offset: opts.offset, topicFilter: opts.topicFilter }),
  });
}

export function useKnowledgeGraphs() {
  return useQuery({ queryKey: KEYS.knowledgeGraphs, queryFn: api.listKnowledgeGraphs });
}

export function useBuildKnowledgeGraph() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ topic, paperIds }: { topic: string; paperIds: string[] }) => api.buildKnowledgeGraph(topic, paperIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.knowledgeGraphs });
    },
  });
}

export function useDeleteKnowledgeGraph() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteKnowledgeGraph(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.knowledgeGraphs });
    },
  });
}

export function useChatSessions() {
  return useQuery({ queryKey: KEYS.chatSessions, queryFn: api.listChatSessions });
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: KEYS.chatMessages(sessionId ?? ""),
    queryFn: () => api.listChatMessages(sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export { KEYS as researchQueryKeys };
