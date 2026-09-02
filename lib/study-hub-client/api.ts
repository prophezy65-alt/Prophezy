"use client";

/**
 * Browser-safe API client for the Study Hub page. Only ever imports
 * *types* from other modules (erased at compile time) — never runtime
 * code, since several of those modules' service layers use server-only
 * Supabase clients that must never reach a client bundle.
 */
import type { Bookmark, ContentView, StudyAnalytics, StudyEntityType, StudySession } from "@/lib/study-hub/types";
import type { FlashcardDeck } from "@/lib/flashcards/models/deck.model";
import type { AttemptHistoryRow } from "@/lib/quiz/providers/supabase-quiz.provider";

export class StudyHubApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "StudyHubApiError";
    this.code = code;
    this.status = status;
  }
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new StudyHubApiError("Unexpected response from the server.", "BAD_RESPONSE", res.status);
  }
  if (!res.ok || !body.ok) {
    throw new StudyHubApiError(body.error?.message ?? "Something went wrong.", body.error?.code ?? "UNKNOWN", res.status);
  }
  return body.data as T;
}

/**
 * lib/quiz's http/response.ts uses a DIFFERENT convention from every other
 * module here — success returns the raw payload directly (no {ok,data}
 * wrapper), failure returns {error: string} and relies on the HTTP status
 * code, not a body-level `ok` flag. Confirmed by reading the actual file,
 * not assumed from its "mirrors... closely enough" comment, which is
 * misleading — the shapes are not interchangeable with request() above.
 */
async function requestQuiz<T>(path: string): Promise<T> {
  const res = await fetch(path);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new StudyHubApiError("Unexpected response from the server.", "BAD_RESPONSE", res.status);
  }
  if (!res.ok) {
    const message = typeof body === "object" && body !== null && "error" in body ? String((body as { error: unknown }).error) : "Something went wrong.";
    throw new StudyHubApiError(message, "QUIZ_ERROR", res.status);
  }
  return body as T;
}

export const studyHubApi = {
  // --- bookmarks ---
  listBookmarks(entityType?: StudyEntityType): Promise<Bookmark[]> {
    const qs = entityType ? `?entityType=${entityType}` : "";
    return request(`/api/bookmarks${qs}`);
  },
  addBookmark(entityType: StudyEntityType, entityId: string): Promise<Bookmark> {
    return request(`/api/bookmarks`, { method: "POST", body: JSON.stringify({ entityType, entityId }) });
  },
  removeBookmark(entityType: StudyEntityType, entityId: string): Promise<{ removed: string }> {
    return request(`/api/bookmarks?entityType=${entityType}&entityId=${entityId}`, { method: "DELETE" });
  },

  // --- recently viewed ---
  listRecentlyViewed(entityType?: StudyEntityType, limit = 20): Promise<ContentView[]> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (entityType) qs.set("entityType", entityType);
    return request(`/api/content-views?${qs.toString()}`);
  },

  // --- study sessions / streaks ---
  getSessionsOverview(): Promise<{ analytics: StudyAnalytics; activeSession: StudySession | null }> {
    return request(`/api/study-sessions`);
  },
  startSession(subject?: string): Promise<StudySession> {
    return request(`/api/study-sessions`, { method: "POST", body: JSON.stringify({ subject }) });
  },
  endSession(sessionId: string, notes?: string): Promise<StudySession> {
    return request(`/api/study-sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify({ notes }) });
  },

  // --- read-only peeks into other (verified-healthy) modules, for "Continue Learning" ---
  listFlashcardDecks(): Promise<FlashcardDeck[]> {
    return request(`/api/flashcards/decks`);
  },
  listQuizHistory(): Promise<{ attempts: AttemptHistoryRow[] }> {
    return requestQuiz(`/api/quiz/history`);
  },
};
