"use client";

/**
 * components/flashcards/useFlashcardsApi.ts
 *
 * Thin React Query wrappers around every /api/flashcards/* route. Every
 * route returns { ok: true, data } / { ok: false, error }, per
 * lib/flashcards/http/response.ts — apiFetch() unwraps that envelope once
 * so hooks/components just deal with plain data or a thrown Error.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Flashcard } from "@/lib/flashcards/models/flashcard.model";
import type { FlashcardDeck, LearningMode, SourceType } from "@/lib/flashcards/models/deck.model";
import type { CardType } from "@/lib/flashcards/models/flashcard.model";
import type { DeckAnalytics, UserAnalytics } from "@/lib/flashcards/models/analytics.model";
import type { ReviewQueue, FlashcardSchedule } from "@/lib/flashcards/models/schedule.model";
import type { ReviewRating } from "@/lib/flashcards/models/review.model";
import type { SearchResult } from "@/lib/flashcards/services/search.service";
import type { ImportFormat, ImportResult } from "@/lib/flashcards/import/import.service";

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

  // Export routes return a raw file body, not the {ok,data} envelope.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return (await res.blob()) as unknown as T;
  }

  const body = await res.json();
  if (!body.ok) {
    const error: ApiError = body.error;
    throw new Error(error.message ?? "Request failed.");
  }
  return body.data as T;
}

const keys = {
  decks: ["flashcards", "decks"] as const,
  deck: (id: string) => ["flashcards", "deck", id] as const,
  cards: (deckId: string) => ["flashcards", "deck", deckId, "cards"] as const,
  reviewQueue: (deckId: string) => ["flashcards", "deck", deckId, "review-queue"] as const,
  deckAnalytics: (deckId: string) => ["flashcards", "deck", deckId, "analytics"] as const,
  userAnalytics: ["flashcards", "analytics"] as const,
  search: (query: string, mode: string, deckId?: string) => ["flashcards", "search", query, mode, deckId] as const,
};

// ---- decks ----------------------------------------------------------------

export function useDecks() {
  return useQuery({ queryKey: keys.decks, queryFn: () => apiFetch<FlashcardDeck[]>("/api/flashcards/decks") });
}

export function useDeck(deckId: string | undefined) {
  return useQuery({
    queryKey: keys.deck(deckId ?? ""),
    queryFn: () => apiFetch<{ deck: FlashcardDeck; cards: Flashcard[] }>(`/api/flashcards/decks/${deckId}`),
    enabled: !!deckId,
  });
}

export interface GenerateDeckParams {
  title?: string;
  sourceType: SourceType;
  sourceRef?: string;
  text?: string;
  learningMode?: LearningMode;
  cardTypes?: CardType[];
  targetCardCount?: number;
}

export function useGenerateDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: GenerateDeckParams) =>
      apiFetch<{ deck: FlashcardDeck; cards: Flashcard[]; droppedDuplicateCount: number }>("/api/flashcards/decks", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.decks }),
  });
}

export function useDeleteDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deckId: string) => apiFetch(`/api/flashcards/decks/${deckId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.decks }),
  });
}

// ---- cards ------------------------------------------------------------

export interface CreateCardParams {
  deckId: string;
  cardType: CardType;
  front: string;
  back: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  hint?: string | null;
}

export function useCreateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deckId, ...body }: CreateCardParams) =>
      apiFetch<Flashcard>(`/api/flashcards/decks/${deckId}/cards`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.deck(variables.deckId) });
      queryClient.invalidateQueries({ queryKey: keys.cards(variables.deckId) });
    },
  });
}

export function useUpdateCard(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, ...body }: { cardId: string; front?: string; back?: string; tags?: string[]; hint?: string | null }) =>
      apiFetch<Flashcard>(`/api/flashcards/cards/${cardId}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.deck(deckId) }),
  });
}

export function useDeleteCard(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => apiFetch(`/api/flashcards/cards/${cardId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.deck(deckId) }),
  });
}

// ---- review / spaced repetition -----------------------------------------

export interface ReviewQueueResponse {
  due: Array<{ schedule: FlashcardSchedule; card: Flashcard }>;
  learning: Array<{ schedule: FlashcardSchedule; card: Flashcard }>;
  newCards: Array<{ schedule: FlashcardSchedule; card: Flashcard }>;
  overdueCount: number;
}

export function useReviewQueue(deckId: string | undefined) {
  return useQuery({
    queryKey: keys.reviewQueue(deckId ?? ""),
    queryFn: () => apiFetch<ReviewQueueResponse>(`/api/flashcards/decks/${deckId}/review-queue`),
    enabled: !!deckId,
  });
}

export function useSubmitReview(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, rating, responseTimeMs }: { cardId: string; rating: ReviewRating; responseTimeMs?: number }) =>
      apiFetch<{ newEaseFactor: number; newIntervalDays: number; newDueAt: string }>(`/api/flashcards/cards/${cardId}/review`, {
        method: "POST",
        body: JSON.stringify({ rating, responseTimeMs }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.reviewQueue(deckId) });
      queryClient.invalidateQueries({ queryKey: keys.deckAnalytics(deckId) });
    },
  });
}

export function useStartSession(deckId: string) {
  return useMutation({
    mutationFn: () => apiFetch<{ id: string }>(`/api/flashcards/decks/${deckId}/sessions`, { method: "POST" }),
  });
}

export function useEndSession(deckId: string) {
  return useMutation({
    mutationFn: ({ sessionId, cardsSeen, cardsCorrect }: { sessionId: string; cardsSeen: number; cardsCorrect: number }) =>
      apiFetch(`/api/flashcards/decks/${deckId}/sessions`, {
        method: "PATCH",
        body: JSON.stringify({ sessionId, cardsSeen, cardsCorrect }),
      }),
  });
}

export function useHint(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => apiFetch<{ hint: string }>(`/api/flashcards/cards/${cardId}/hint`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.deck(deckId) }),
  });
}

export function useMnemonic(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) =>
      apiFetch<{ mnemonic: string; memoryTrick: string | null; analogy: string | null }>(`/api/flashcards/cards/${cardId}/mnemonic`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.deck(deckId) }),
  });
}

// ---- analytics --------------------------------------------------------

export function useDeckAnalytics(deckId: string | undefined) {
  return useQuery({
    queryKey: keys.deckAnalytics(deckId ?? ""),
    queryFn: () => apiFetch<DeckAnalytics>(`/api/flashcards/decks/${deckId}/analytics`),
    enabled: !!deckId,
  });
}

export function useUserAnalytics() {
  return useQuery({ queryKey: keys.userAnalytics, queryFn: () => apiFetch<UserAnalytics>("/api/flashcards/analytics") });
}

// ---- search -------------------------------------------------------------

export function useFlashcardSearch(query: string, mode: string, deckId?: string) {
  return useQuery({
    queryKey: keys.search(query, mode, deckId),
    queryFn: () =>
      apiFetch<SearchResult[]>(
        `/api/flashcards/search?${new URLSearchParams({ q: query, mode, ...(deckId ? { deckId } : {}) }).toString()}`
      ),
    enabled: query.trim().length > 0,
  });
}

// ---- import / export ----------------------------------------------------

export function useImportCards(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ format, content }: { format: ImportFormat; content: string }) =>
      apiFetch<ImportResult>(`/api/flashcards/decks/${deckId}/import`, {
        method: "POST",
        body: JSON.stringify({ format, content }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.deck(deckId) }),
  });
}

export function exportDeckUrl(deckId: string, format: string): string {
  return `/api/flashcards/decks/${deckId}/export?format=${format}`;
}
