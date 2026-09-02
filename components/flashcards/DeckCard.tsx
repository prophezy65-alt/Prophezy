"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Layers, Trash2, ArrowUpRight, Radio } from "lucide-react";
import type { FlashcardDeck } from "@/lib/flashcards/models/deck.model";

interface DeckCardProps {
  deck: FlashcardDeck;
  onDelete: (deckId: string) => void;
  isDeleting: boolean;
}

/**
 * Flashcards-only visual treatment. Deliberately does NOT use the shared
 * <Card>/<Badge>/<Button> primitives from components/ui/*, since those pull
 * the app-wide purple "signal" token used on every other page. Everything
 * here is scoped, self-contained styling so no other screen is affected.
 */
export default function DeckCard({ deck, onDelete, isDeleting }: DeckCardProps) {
  const modeLabel = deck.learningMode.replace(/_/g, " ");
  const sourceLabel = deck.sourceType?.replace(/_/g, " ");
  const idTag = deck.id.slice(0, 8).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative"
    >
      <div
        className="relative h-full overflow-hidden rounded-2xl border border-teal-400/15 bg-gradient-to-b from-[#0c141f] to-[#070b12] p-5 shadow-[0_0_0_1px_rgba(45,212,191,0.03)] transition-all duration-300 hover:border-teal-300/40 hover:shadow-[0_0_28px_-8px_rgba(45,212,191,0.35)]"
      >
        {/* faint corner scanlines / grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(45,212,191,1) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,1) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />

        {/* header row */}
        <div className="relative mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-400/25 bg-teal-400/5 text-teal-300">
              <Layers size={17} strokeWidth={1.7} />
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-400/70">
                DECK · {idTag}
              </p>
              <h3 className="line-clamp-1 font-display text-base font-medium tracking-tight text-slate-100">
                {deck.title}
              </h3>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete(deck.id);
            }}
            disabled={isDeleting}
            className="text-slate-600 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
            aria-label="Delete deck"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* telemetry rows, echoing a mission-readout panel */}
        <div className="relative mb-5 space-y-2 rounded-xl border border-white/[0.06] bg-black/20 px-3.5 py-3">
          <TelemetryRow label="Cards loaded" value={String(deck.cardCount).padStart(2, "0")} />
          <TelemetryRow label="Mode" value={modeLabel} accent />
          {sourceLabel && <TelemetryRow label="Source" value={sourceLabel} />}
          <TelemetryRow
            label="Status"
            value="Ready"
            icon={<Radio size={11} className="text-emerald-400" />}
          />
        </div>

        {/* footer */}
        <Link
          href={`/app/flashcards/${deck.id}`}
          className="relative inline-flex items-center gap-1.5 text-sm font-medium text-teal-300 transition-colors hover:text-teal-200"
        >
          Open deck
          <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </motion.div>
  );
}

function TelemetryRow({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="font-mono uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <span
        className={
          "flex items-center gap-1.5 truncate font-mono font-medium " +
          (accent ? "text-teal-300" : "text-slate-300")
        }
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
