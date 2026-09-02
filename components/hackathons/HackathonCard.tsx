"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Clock, ExternalLink, MapPin, Trophy, Users } from "lucide-react";
import { calculateUrgency, daysUntil } from "@/lib/hackathons/utils/timeline-calculator";
import type { Hackathon } from "@/lib/hackathons/models/hackathon.model";
import { useSaveHackathon, useUnsaveHackathon } from "./useHackathonsApi";
import { useToast } from "./Toast";

/**
 * Palette — matched to the vidadu-style reference (coral / teal / violet /
 * amber on white), not the "cream + terracotta" combo that's become an AI
 * design default. Colors are load-bearing here, not decoration: the card's
 * top edge and deadline pill both use the urgency color, so at-a-glance
 * scanning a grid of cards tells you what's due soon without reading text.
 */
const PALETTE = {
  ink: "#171521",
  mist: "#726F82",
  line: "#EDEBF5",
  coral: "#FF5A4E",
  teal: "#17C3A6",
  violet: "#6C4FE0",
  sun: "#D99A00",
};

const URGENCY_COLOR: Record<string, string> = {
  past: PALETTE.mist,
  urgent: PALETTE.coral,
  soon: PALETTE.sun,
  upcoming: PALETTE.teal,
  far: PALETTE.violet,
};

const TAG_COLORS = [PALETTE.coral, PALETTE.teal, PALETTE.violet, PALETTE.sun];

function formatDeadline(daysLeft: number): string {
  if (daysLeft < 0) return "Deadline passed";
  if (daysLeft < 1) return "Due today";
  if (daysLeft < 2) return "1 day left";
  if (daysLeft < 30) return `${Math.floor(daysLeft)} days left`;
  return `${Math.floor(daysLeft / 30)} months left`;
}

interface HackathonCardProps {
  hackathon: Hackathon;
  isSaved: boolean;
}

export default function HackathonCard({ hackathon, isSaved }: HackathonCardProps) {
  const save = useSaveHackathon();
  const unsave = useUnsaveHackathon();
  const toast = useToast();

  const urgency = calculateUrgency(hackathon.timeline.submissionDeadline);
  const daysLeft = daysUntil(hackathon.timeline.submissionDeadline);
  const pending = save.isPending || unsave.isPending;
  const accent = URGENCY_COLOR[urgency] ?? PALETTE.violet;

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isSaved) {
        await unsave.mutateAsync(hackathon.id);
        toast.show("Removed from saved", "success");
      } else {
        await save.mutateAsync(hackathon.id);
        toast.show("Saved", "success");
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  const prizePool = hackathon.prizes.totalPoolUsd
    ? `$${hackathon.prizes.totalPoolUsd.toLocaleString()}`
    : hackathon.prizes.hasCash
      ? "Cash prizes"
      : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <div
        className="group relative flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(23,21,33,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(23,21,33,0.18)]"
        style={{ border: `1px solid ${PALETTE.line}` }}
      >
        {/* Signature element: urgency-colored spine along the top edge */}
        <div className="h-[6px] w-full shrink-0" style={{ backgroundColor: accent }} />

        <div className="flex flex-1 flex-col p-5">
          <Link href={`/app/hackathons/${encodeURIComponent(hackathon.id)}`} className="flex flex-1 flex-col">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-[17px] font-extrabold leading-snug tracking-tight" style={{ color: PALETTE.ink }}>
                  {hackathon.title}
                </h3>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: PALETTE.mist }}>
                  {hackathon.organizer.name}
                </p>
              </div>
              <button
                onClick={handleToggleSave}
                disabled={pending}
                className="shrink-0 rounded-full p-2 transition-colors disabled:opacity-50"
                style={{ color: isSaved ? PALETTE.violet : PALETTE.mist }}
                aria-label={isSaved ? "Unsave hackathon" : "Save hackathon"}
              >
                {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              </button>
            </div>

            <p className="mb-3.5 line-clamp-2 text-[13.5px] leading-relaxed" style={{ color: "#4B4859" }}>
              {hackathon.description}
            </p>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {hackathon.themes.slice(0, 3).map((theme, i) => {
                const c = TAG_COLORS[i % TAG_COLORS.length];
                return (
                  <span
                    key={theme}
                    className="rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                    style={{ backgroundColor: `${c}17`, color: c }}
                  >
                    {theme}
                  </span>
                );
              })}
              {hackathon.mode && (
                <span
                  className="rounded-full px-2.5 py-1 text-[10.5px] font-bold capitalize"
                  style={{ backgroundColor: "#171521", color: "#fff" }}
                >
                  {hackathon.mode}
                </span>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t pt-3.5 text-[12px] font-semibold" style={{ borderColor: PALETTE.line }}>
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1"
                style={{ backgroundColor: `${accent}17`, color: accent }}
              >
                <Clock size={11} strokeWidth={2.75} /> {formatDeadline(daysLeft)}
              </span>
              {prizePool && (
                <span className="flex items-center gap-1" style={{ color: PALETTE.ink }}>
                  <Trophy size={12} strokeWidth={2.5} style={{ color: PALETTE.sun }} /> {prizePool}
                </span>
              )}
              {hackathon.location && (
                <span className="flex items-center gap-1" style={{ color: PALETTE.mist }}>
                  <MapPin size={12} strokeWidth={2.5} style={{ color: PALETTE.violet }} /> {hackathon.location}
                </span>
              )}
              {hackathon.teamSizeMax && (
                <span className="flex items-center gap-1" style={{ color: PALETTE.mist }}>
                  <Users size={12} strokeWidth={2.5} style={{ color: PALETTE.teal }} /> up to {hackathon.teamSizeMax}
                </span>
              )}
            </div>
          </Link>

          <a
            href={hackathon.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: PALETTE.coral }}
          >
            Register <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
