"use client";

import Link from "next/link";
import { Layers, HelpCircle, ChevronRight } from "lucide-react";
import { useFlashcardDecks, useQuizHistory } from "@/lib/study-hub-client/hooks";

export function ContinueLearning() {
  const decks = useFlashcardDecks();
  const quizzes = useQuizHistory();

  const recentDecks = (decks.data ?? [])
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  const inProgressQuizzes = (quizzes.data?.attempts ?? [])
    .filter((a) => a.status === "in_progress")
    .slice(0, 4);

  const loading = decks.isLoading || quizzes.isLoading;
  const nothingToShow = !loading && recentDecks.length === 0 && inProgressQuizzes.length === 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-panel h-16 animate-pulse rounded-xl border border-border" />
        ))}
      </div>
    );
  }

  if (nothingToShow) {
    return (
      <div className="glass-panel rounded-2xl border border-border p-8 text-center text-sm text-mist">
        Nothing in progress yet — generate a flashcard deck or start a quiz to see it here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {recentDecks.map((deck) => (
        <Link
          key={deck.id}
          href={`/app/flashcards/${deck.id}/review`}
          className="glass-panel flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:border-signal/30"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
            <Layers size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{deck.title}</p>
            <p className="text-xs text-mist">{deck.cardCount} cards</p>
          </div>
          <ChevronRight size={14} className="shrink-0 text-mist" />
        </Link>
      ))}

      {inProgressQuizzes.map((attempt) => (
        <Link
          key={attempt.id}
          href={`/app/quiz/attempts/${attempt.id}`}
          className="glass-panel flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:border-signal/30"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pulse/10 text-pulse">
            <HelpCircle size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{attempt.quizTitle}</p>
            <p className="text-xs text-mist">{attempt.completionPct}% complete</p>
          </div>
          <ChevronRight size={14} className="shrink-0 text-mist" />
        </Link>
      ))}
    </div>
  );
}
