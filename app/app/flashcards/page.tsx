"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, Plus, AlertCircle, Loader2, Quote, RefreshCcw } from "lucide-react";
import { ToastProvider, useToast } from "@/components/flashcards/Toast";
import { useDecks, useDeleteDeck } from "@/components/flashcards/useFlashcardsApi";
import DeckCard from "@/components/flashcards/DeckCard";
import GenerateDeckModal from "@/components/flashcards/GenerateDeckModal";

/**
 * NOTE ON SCOPE
 * This file intentionally restyles ONLY the Flashcards list screen. It does
 * not touch components/ui/* (Button, Card, Badge) or globals.css, so every
 * other page in the app keeps its current look untouched. The dark
 * teal/graphite "mission-readout" theme below lives entirely inside this
 * route's own wrapper <div>.
 */

const QUOTES = [
  "Recall is the receipt. Rereading is just window-shopping.",
  "You don't remember what you read. You remember what you retrieve.",
  "Every card you flip is a rep. Every rep is a rung.",
  "Forgetting is the tax on skipping review. Pay early, pay less.",
  "Small decks, repeated often, beat big decks, opened once.",
  "The gap between reading and knowing is called practice.",
];

function FlashcardsPageContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: decks, isLoading, isError, error } = useDecks();
  const deleteDeck = useDeleteDeck();
  const toast = useToast();

  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const quote = useMemo(() => QUOTES[quoteIndex], [quoteIndex]);

  function nextQuote() {
    setQuoteIndex((i) => (i + 1) % QUOTES.length);
  }

  async function handleDelete(deckId: string) {
    if (!confirm("Delete this deck and all its cards? This can't be undone.")) return;
    try {
      await deleteDeck.mutateAsync(deckId);
      toast.show("Deck deleted.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to delete deck.", "error");
    }
  }

  return (
    <div className="relative mx-auto max-w-6xl rounded-3xl border border-white/[0.06] bg-[#050810] p-6 sm:p-8">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-teal-500/10 blur-3xl"
      />

      <div className="relative mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-teal-400/70">
            Study module · Spaced repetition
          </p>
          <h1 className="font-display text-2xl font-medium text-slate-100">Flashcard Decks</h1>
          <p className="mt-1 text-sm text-slate-500">Generated from your own notes, reviewed on a schedule that sticks.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-2.5 text-sm font-medium text-teal-200 shadow-[0_0_20px_-6px_rgba(45,212,191,0.5)] transition-all hover:border-teal-300/50 hover:bg-teal-400/15 active:scale-[0.98]"
        >
          <Plus size={16} /> Generate deck
        </button>
      </div>

      {/* interactive motto strip */}
      <button
        onClick={nextQuote}
        className="group relative mb-8 flex w-full items-center gap-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-teal-400/25"
        aria-label="Show another quote"
      >
        <Quote size={15} className="shrink-0 text-teal-400/70" />
        <AnimatePresence mode="wait">
          <motion.p
            key={quoteIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex-1 truncate font-mono text-xs text-slate-400 sm:text-sm"
          >
            {quote}
          </motion.p>
        </AnimatePresence>
        <RefreshCcw
          size={13}
          className="shrink-0 text-slate-600 transition-transform duration-300 group-hover:rotate-180 group-hover:text-teal-300"
        />
      </button>

      {isLoading && (
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
          <AlertCircle size={28} className="text-rose-400" />
          <p className="text-sm text-slate-500">{error instanceof Error ? error.message : "Failed to load decks."}</p>
        </div>
      )}

      {!isLoading && !isError && decks && decks.length === 0 && (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-teal-400/25 bg-teal-400/5">
            <Layers size={26} className="text-teal-300" strokeWidth={1.6} />
          </div>
          <h2 className="font-display text-lg font-medium text-slate-100">No decks yet</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Paste your notes, a textbook excerpt, or a URL and Prophezy will generate a spaced-repetition deck for you.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-2.5 text-sm font-medium text-teal-200 transition-all hover:border-teal-300/50 hover:bg-teal-400/15 active:scale-[0.98]"
          >
            <Plus size={16} /> Generate your first deck
          </button>
        </div>
      )}

      {!isLoading && !isError && decks && decks.length > 0 && (
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {decks.map((deck) => (
              <DeckCard key={deck.id} deck={deck} onDelete={handleDelete} isDeleting={deleteDeck.isPending} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <GenerateDeckModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

export default function FlashcardsPage() {
  return (
    <ToastProvider>
      <FlashcardsPageContent />
    </ToastProvider>
  );
}
