"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Lightbulb, Sparkles, Loader2, AlertCircle, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToastProvider, useToast } from "@/components/flashcards/Toast";
import {
  useReviewQueue,
  useSubmitReview,
  useStartSession,
  useEndSession,
  useHint,
  useMnemonic,
} from "@/components/flashcards/useFlashcardsApi";
import type { ReviewRating } from "@/lib/flashcards/models/review.model";
import type { Flashcard } from "@/lib/flashcards/models/flashcard.model";

const RATING_OPTIONS: { value: ReviewRating; label: string; className: string }[] = [
  { value: "forgot", label: "Forgot", className: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20" },
  { value: "hard", label: "Hard", className: "border-orange-400/40 bg-orange-400/10 text-orange-300 hover:bg-orange-400/20" },
  { value: "medium", label: "Good", className: "border-signal/40 bg-signal/10 text-signal hover:bg-signal/20" },
  { value: "easy", label: "Easy", className: "border-success/40 bg-success/10 text-success hover:bg-success/20" },
];

function ReviewSessionContent({ deckId }: { deckId: string }) {
  const { data: queue, isLoading, isError, error } = useReviewQueue(deckId);
  const submitReview = useSubmitReview(deckId);
  const startSession = useStartSession(deckId);
  const endSession = useEndSession(deckId);
  const hint = useHint(deckId);
  const mnemonic = useMnemonic(deckId);
  const toast = useToast();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [revealedHint, setRevealedHint] = useState<string | null>(null);
  const [revealedMnemonic, setRevealedMnemonic] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [cardStartedAt, setCardStartedAt] = useState<number>(Date.now());

  const cards: Flashcard[] = useMemo(() => {
    if (!queue) return [];
    return [...queue.due, ...queue.learning, ...queue.newCards].map((entry) => entry.card).filter((c): c is Flashcard => !!c);
  }, [queue]);

  useEffect(() => {
    if (queue && !sessionId) {
      startSession.mutate(undefined, { onSuccess: (session) => setSessionId(session.id) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const currentCard = cards[index];
  const isComplete = cards.length > 0 && index >= cards.length;

  useEffect(() => {
    setCardStartedAt(Date.now());
    setRevealedHint(null);
    setRevealedMnemonic(null);
    setFlipped(false);
  }, [index]);

  async function finishSession() {
    if (sessionId) {
      await endSession.mutateAsync({ sessionId, cardsSeen: seen, cardsCorrect: correct }).catch(() => undefined);
    }
  }

  async function handleRate(rating: ReviewRating) {
    if (!currentCard) return;
    try {
      await submitReview.mutateAsync({
        cardId: currentCard.id,
        rating,
        responseTimeMs: Date.now() - cardStartedAt,
      });
      setSeen((s) => s + 1);
      if (rating === "medium" || rating === "easy") setCorrect((c) => c + 1);

      if (index + 1 >= cards.length) {
        await finishSession();
      }
      setIndex((i) => i + 1);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to submit review.", "error");
    }
  }

  async function handleHint() {
    if (!currentCard) return;
    if (currentCard.hint) {
      setRevealedHint(currentCard.hint);
      return;
    }
    try {
      const result = await hint.mutateAsync(currentCard.id);
      setRevealedHint(result.hint);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to generate hint.", "error");
    }
  }

  async function handleMnemonic() {
    if (!currentCard) return;
    if (currentCard.mnemonic) {
      setRevealedMnemonic(currentCard.mnemonic);
      return;
    }
    try {
      const result = await mnemonic.mutateAsync(currentCard.id);
      setRevealedMnemonic(result.mnemonic);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to generate mnemonic.", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-mist">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle size={28} className="text-danger" />
        <p className="text-sm text-mist">{error instanceof Error ? error.message : "Failed to load review queue."}</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <Link href={`/app/flashcards/${deckId}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-mist hover:text-ink">
          <ArrowLeft size={14} /> Back to deck
        </Link>
        <div className="flex min-h-[40vh] flex-col items-center justify-center">
          <PartyPopper size={32} className="mb-4 text-signal" />
          <h2 className="font-display text-lg font-medium text-ink">Nothing due right now</h2>
          <p className="mt-2 text-sm text-mist">All caught up — check back later or add more cards.</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="flex min-h-[50vh] flex-col items-center justify-center">
          <PartyPopper size={32} className="mb-4 text-signal" />
          <h2 className="font-display text-xl font-medium text-ink">Session complete</h2>
          <p className="mt-2 text-sm text-mist">
            Reviewed {seen} cards · {correct} correct
          </p>
          <Link href={`/app/flashcards/${deckId}`} className="mt-6">
            <Button>Back to deck</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    // Unreachable given the isComplete/cards.length checks above, but
    // noUncheckedIndexedAccess correctly can't prove that from a length
    // comparison alone — this keeps the render below soundly typed.
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/app/flashcards/${deckId}`} className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-ink">
          <ArrowLeft size={14} /> Exit review
        </Link>
        <span className="text-xs font-medium uppercase tracking-wide text-mist">
          {index + 1} / {cards.length}
        </span>
      </div>

      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className="h-full rounded-full bg-signal"
          animate={{ width: `${(index / cards.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
        >
          <div
            onClick={() => setFlipped((f) => !f)}
            className="glass-panel flex min-h-[260px] cursor-pointer flex-col items-center justify-center p-10 text-center"
          >
            <span className="mb-4 text-xs font-medium uppercase tracking-wide text-mist">
              {flipped ? "Answer" : "Question"}
            </span>
            <p className="text-lg font-medium text-ink">{flipped ? currentCard.back : currentCard.front}</p>
            {!flipped && <p className="mt-6 text-xs text-mist">Click to reveal answer</p>}
          </div>

          {revealedHint && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-signal/20 bg-signal/5 p-3 text-sm text-ink">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-signal" /> {revealedHint}
            </div>
          )}
          {revealedMnemonic && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-pulse/20 bg-pulse/5 p-3 text-sm text-ink">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-pulse" /> {revealedMnemonic}
            </div>
          )}

          <div className="mt-4 flex justify-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleHint} disabled={hint.isPending}>
              <Lightbulb size={14} className="mr-1" /> Hint
            </Button>
            <Button variant="ghost" size="sm" onClick={handleMnemonic} disabled={mnemonic.isPending}>
              <Sparkles size={14} className="mr-1" /> Mnemonic
            </Button>
          </div>

          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 grid grid-cols-4 gap-2"
            >
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleRate(opt.value)}
                  disabled={submitReview.isPending}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${opt.className}`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function ReviewPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params);
  return (
    <ToastProvider>
      <ReviewSessionContent deckId={deckId} />
    </ToastProvider>
  );
}
