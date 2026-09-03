"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
  BarChart3,
  Target,
  TrendingUp,
  Gauge,
} from "lucide-react";
import { ToastProvider, useToast } from "@/components/flashcards/Toast";
import {
  useDeck,
  useDeleteCard,
  useDeckAnalytics,
  useImportCards,
  exportDeckUrl,
} from "@/components/flashcards/useFlashcardsApi";
import type { ImportFormat } from "@/lib/flashcards/import/import.service";

/**
 * Scoped like the flashcards list page: no components/ui/* primitives
 * (Button/Card/Badge) so this dark teal theme stays isolated to the
 * Flashcards module and doesn't touch any other screen.
 */

const EXPORT_FORMATS: { value: string; label: string; disabled?: boolean }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "txt", label: "Plain text" },
  { value: "html", label: "HTML" },
  { value: "anki", label: "Anki (.txt import)" },
  { value: "pdf", label: "PDF (not available yet)", disabled: true },
  { value: "docx", label: "Word (not available yet)", disabled: true },
];

function DeckDetailContent({ deckId }: { deckId: string }) {
  const { data, isLoading, isError, error } = useDeck(deckId);
  const { data: analytics } = useDeckAnalytics(deckId);
  const deleteCard = useDeleteCard(deckId);
  const importCards = useImportCards(deckId);
  const toast = useToast();

  const [importOpen, setImportOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat>("csv");
  const [importContent, setImportContent] = useState("");

  async function handleDeleteCard(cardId: string) {
    if (!confirm("Delete this card?")) return;
    try {
      await deleteCard.mutateAsync(cardId);
      toast.show("Card deleted.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to delete card.", "error");
    }
  }

  async function handleImport() {
    if (!importContent.trim()) {
      toast.show("Paste content to import.", "error");
      return;
    }
    try {
      const result = await importCards.mutateAsync({ format: importFormat, content: importContent });
      toast.show(`Imported ${result.importedCount} cards${result.skippedCount ? ` (${result.skippedCount} skipped)` : ""}.`, "success");
      setImportOpen(false);
      setImportContent("");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Import failed.", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle size={28} className="text-rose-400" />
        <p className="text-sm text-slate-500">{error instanceof Error ? error.message : "Deck not found."}</p>
        <Link href="/app/flashcards" className="text-sm text-teal-300 hover:underline">
          Back to decks
        </Link>
      </div>
    );
  }

  const { deck, cards } = data;

  return (
    <div className="relative mx-auto max-w-5xl rounded-3xl border border-white/[0.06] bg-[#050810] p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-teal-500/10 blur-3xl"
      />

      <Link
        href="/app/flashcards"
        className="relative mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-teal-300"
      >
        <ArrowLeft size={14} /> All decks
      </Link>

      <div className="relative mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium text-slate-100">{deck.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TagPill accent>{deck.learningMode.replace(/_/g, " ")}</TagPill>
            <TagPill>{deck.cardCount} cards</TagPill>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/flashcards/${deckId}/review`}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 text-sm font-medium text-teal-200 shadow-[0_0_20px_-6px_rgba(45,212,191,0.5)] transition-all hover:border-teal-300/50 hover:bg-teal-400/15 active:scale-[0.98]"
          >
            <Play size={16} /> Start review
          </Link>
          <button
            onClick={() => setImportOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 transition-colors hover:border-teal-400/30 hover:text-teal-200"
          >
            <Upload size={16} /> Import
          </button>
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) window.open(exportDeckUrl(deckId, e.target.value), "_blank");
                e.target.value = "";
              }}
              defaultValue=""
              className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-slate-300 focus:border-teal-400/40 focus:outline-none"
            >
              <option value="" disabled>
                Export as...
              </option>
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value} disabled={f.disabled}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {importOpen && (
        <div className="relative mb-6 rounded-2xl border border-teal-400/15 bg-gradient-to-b from-[#0c141f] to-[#070b12] p-5">
          <h2 className="mb-3 font-display text-base font-medium text-slate-100">Import cards</h2>
          <div className="space-y-3">
            <select
              value={importFormat}
              onChange={(e) => setImportFormat(e.target.value as ImportFormat)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-slate-300 focus:border-teal-400/40 focus:outline-none"
            >
              <option value="csv">CSV (front,back,card_type,difficulty,tags,hint)</option>
              <option value="anki">Anki (tab-separated front/back/tags)</option>
              <option value="json">JSON</option>
            </select>
            <textarea
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              rows={6}
              placeholder="Paste the file content here..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-400/40 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setImportOpen(false)}
                className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importCards.isPending}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 text-sm font-medium text-teal-200 transition-all hover:border-teal-300/50 hover:bg-teal-400/15 disabled:opacity-50"
              >
                {importCards.isPending ? <Loader2 size={16} className="animate-spin" /> : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {analytics && (
        <div className="relative mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={Target} label="Reviewed" value={`${analytics.cardsReviewed}/${analytics.cardsCreated}`} />
          <StatCard icon={TrendingUp} label="Retention" value={`${Math.round(analytics.retention.retentionRate * 100)}%`} />
          <StatCard icon={Gauge} label="Mastery" value={`${Math.round(analytics.masteryScore)}`} />
          <StatCard icon={BarChart3} label="Completion" value={`${Math.round(analytics.completionPercent)}%`} />
        </div>
      )}

      {cards.length === 0 ? (
        <div className="relative flex min-h-[30vh] flex-col items-center justify-center text-center text-sm text-slate-500">
          No cards in this deck yet.
        </div>
      ) : (
        <div className="relative space-y-2">
          <AnimatePresence>
            {cards.map((card, i) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="group flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-teal-400/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-teal-400/60">
                    Card {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="text-sm font-medium text-slate-100">{card.front}</p>
                  <p className="mt-1 text-sm text-slate-500">{card.back}</p>
                  {card.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {card.tags.map((tag) => (
                        <TagPill key={tag}>{tag}</TagPill>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  className="text-slate-600 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                  aria-label="Delete card"
                >
                  <Trash2 size={15} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TagPill({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide " +
        (accent ? "border border-teal-400/30 bg-teal-400/10 text-teal-300" : "border border-white/10 bg-white/[0.03] text-slate-400")
      }
    >
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-teal-400/70">
        <Icon size={14} />
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className="font-display text-xl font-medium text-slate-100">{value}</p>
    </div>
  );
}

export default function DeckDetailPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params);
  return (
    <ToastProvider>
      <DeckDetailContent deckId={deckId} />
    </ToastProvider>
  );
}
