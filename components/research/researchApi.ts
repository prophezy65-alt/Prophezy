/**
 * components/research/researchApi.ts
 * Typed fetch wrappers over /api/research/*. Kept framework-agnostic so
 * useResearchQueries.ts (React Query) is the only place that knows about
 * caching/loading state.
 */
import type { ResearchPaperRow, ResearchCitationRow, ResearchKnowledgeGraphRow } from "@/lib/research/models/db.types";
import type { Paper, AggregatedSearchResult, SearchKind } from "@/lib/research/models/paper.types";
import type { PaperSummaryOutput } from "@/lib/ai/prompts/research-paper";

export class ResearchApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ResearchApiError";
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ResearchApiError(body.error ?? "Request failed.", response.status, body.code);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Papers
// ---------------------------------------------------------------------------

export function listPapers(params: { q?: string; limit?: number; offset?: number } = {}): Promise<{ papers: ResearchPaperRow[] }> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  return request(`/api/research/papers${qs ? `?${qs}` : ""}`);
}

export function getPaper(id: string): Promise<{ paper: ResearchPaperRow; citations: ResearchCitationRow[] }> {
  return request(`/api/research/papers/${id}`);
}

export function deletePaper(id: string): Promise<{ success: boolean }> {
  return request(`/api/research/papers/${id}`, { method: "DELETE" });
}

export function savePaperFromSearch(paper: Paper): Promise<{ paper: ResearchPaperRow }> {
  return request("/api/research/papers", { method: "POST", body: JSON.stringify({ paper }) });
}

export async function uploadPaper(file: File): Promise<{ paper: ResearchPaperRow }> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let response: Response;
  try {
    response = await fetch("/api/research/papers/upload", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ResearchApiError(
        "Upload timed out after 90s. The file may be large, or the server may be stuck — check the dev server terminal.",
        0
      );
    }
    throw err instanceof Error ? new ResearchApiError(err.message, 0) : err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ResearchApiError(body.error ?? "Upload failed.", response.status, body.code);
  }
  return response.json();
}

export function generateSummary(paperId: string, forceRefresh = false): Promise<{ paper: ResearchPaperRow; structured: PaperSummaryOutput }> {
  return request(`/api/research/papers/${paperId}/summary`, { method: "POST", body: JSON.stringify({ forceRefresh }) });
}

export function listCitations(paperId: string): Promise<{ citations: ResearchCitationRow[] }> {
  return request(`/api/research/papers/${paperId}/citations`);
}

export function extractCitations(paperId: string): Promise<{ citations: ResearchCitationRow[] }> {
  return request(`/api/research/papers/${paperId}/citations`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// External search + topic explorer
// ---------------------------------------------------------------------------

export function searchExternalPapers(query: string, kind: SearchKind = "keyword"): Promise<AggregatedSearchResult> {
  const search = new URLSearchParams({ q: query, kind });
  return request(`/api/research/search?${search.toString()}`);
}

export interface TopicChipCount {
  label: string;
  count: number;
}

export interface TopicSearchResult {
  topic: string;
  expandedTerms: string[];
  papers: Paper[];
  total: number;
  chips: TopicChipCount[];
  chipsApproximate: boolean;
  tookMs: number;
}

/**
 * REPLACES generateTopicOverview(). That function POSTed to
 * /api/research/topic to have Gemini write a prose overview — no real
 * papers, and it burned Gemini quota for plain browsing. This calls the
 * same route, now a deterministic GET backed by Postgres full-text search
 * over the synced paper library (see lib/research/services/
 * topic-explorer.service.ts) — zero Gemini, zero credit cost.
 */
export function searchTopicExplorer(
  topic: string,
  opts: { limit?: number; offset?: number; topicFilter?: string } = {}
): Promise<TopicSearchResult> {
  const search = new URLSearchParams({ topic });
  if (opts.limit) search.set("limit", String(opts.limit));
  if (opts.offset) search.set("offset", String(opts.offset));
  if (opts.topicFilter) search.set("topicFilter", opts.topicFilter);
  return request(`/api/research/topic?${search.toString()}`);
}

// ---------------------------------------------------------------------------
// Knowledge graph
// ---------------------------------------------------------------------------

export function listKnowledgeGraphs(): Promise<{ graphs: ResearchKnowledgeGraphRow[] }> {
  return request("/api/research/knowledge-graph");
}

export function buildKnowledgeGraph(topic: string, paperIds: string[]): Promise<{ graph: ResearchKnowledgeGraphRow }> {
  return request("/api/research/knowledge-graph", { method: "POST", body: JSON.stringify({ topic, paperIds }) });
}

export function deleteKnowledgeGraph(id: string): Promise<{ success: boolean }> {
  return request(`/api/research/knowledge-graph/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatSessionSummary {
  id: string;
  user_id: string;
  title: string;
  status: "active" | "archived";
  last_message_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageSummary {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modules_invoked: string[] | null;
  intent: Record<string, unknown> | null;
  created_at: string;
}

export function listChatSessions(): Promise<{ sessions: ChatSessionSummary[] }> {
  return request("/api/research/chat/sessions");
}

export function listChatMessages(sessionId: string): Promise<{ messages: ChatMessageSummary[] }> {
  return request(`/api/research/chat/sessions/${sessionId}`);
}

export interface ChatSource {
  documentId: string;
  pageIndex: number | null;
  snippet: string;
}

export interface StreamChatOptions {
  sessionId?: string;
  paperId?: string;
  message: string;
  signal?: AbortSignal;
  onDelta: (accumulated: string) => void;
  onSources: (sources: ChatSource[], sessionId: string) => void;
}

/**
 * Streams a chat turn via SSE. Reads the response body manually (rather
 * than EventSource, which can't send a POST body/auth cookies the way
 * `fetch` does) — parses the same `data: {...}\n\n` framing
 * lib/ai/utils/stream.ts's `toSSEResponse` writes.
 */
export async function streamChat(opts: StreamChatOptions): Promise<string> {
  const response = await fetch("/api/research/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: opts.sessionId, paperId: opts.paperId, message: opts.message }),
    signal: opts.signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ResearchApiError(body.error ?? "Chat failed.", response.status, body.code);
  }

  const sessionId = response.headers.get("X-Research-Session-Id") ?? opts.sessionId ?? "";
  const rawSources = response.headers.get("X-Research-Sources");
  const sources: ChatSource[] = rawSources ? JSON.parse(decodeURIComponent(rawSources)) : [];
  opts.onSources(sources, sessionId);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const line = rawEvent.trim();
      if (!line.startsWith("data:")) continue;
      const payload = JSON.parse(line.slice(5).trim()) as { type: string; accumulated?: string; error?: string };
      if (payload.type === "error") throw new ResearchApiError(payload.error ?? "Chat stream error.", 500);
      if (payload.accumulated !== undefined) {
        finalText = payload.accumulated;
        opts.onDelta(finalText);
      }
    }
  }

  return finalText;
}
