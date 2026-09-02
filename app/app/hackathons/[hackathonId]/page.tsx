"use client";

import { use } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Bookmark, BookmarkCheck, Calendar, CheckCircle2,
  ExternalLink, Loader2, MapPin, Trophy, Users,
} from "lucide-react";
import { ToastProvider, useToast } from "@/components/hackathons/Toast";
import {
  useHackathon, useTrackedHackathons, useSaveHackathon, useUnsaveHackathon, useUpdateTrackingStatus,
} from "@/components/hackathons/useHackathonsApi";
import { calculateUrgency, daysUntil } from "@/lib/hackathons/utils/timeline-calculator";

/** Same palette as the list page / card / filter bar — kept in sync manually since this file predates a shared tokens module. */
const PALETTE = {
  ink: "#171521",
  mist: "#726F82",
  line: "#EDEBF5",
  coral: "#FF5A4E",
  teal: "#17C3A6",
  violet: "#6C4FE0",
  sun: "#D99A00",
};

const TAG_COLORS = [PALETTE.coral, PALETTE.teal, PALETTE.violet, PALETTE.sun];

const URGENCY_COLOR: Record<string, string> = {
  past: PALETTE.mist,
  urgent: PALETTE.coral,
  soon: PALETTE.sun,
  upcoming: PALETTE.teal,
  far: PALETTE.violet,
};

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-3xl bg-white p-6" style={{ border: `1px solid ${PALETTE.line}` }}>
      <h2 className="mb-3 text-base font-extrabold tracking-tight" style={{ color: PALETTE.ink }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function HackathonDetailContent({ hackathonId }: { hackathonId: string }) {
  const { data: hackathon, isLoading, isError, error } = useHackathon(hackathonId);
  const { data: tracked } = useTrackedHackathons();
  const save = useSaveHackathon();
  const unsave = useUnsaveHackathon();
  const updateStatus = useUpdateTrackingStatus();
  const toast = useToast();

  const trackingEntry = tracked?.find((t) => t.hackathon.id === hackathonId)?.entry;
  const isSaved = !!trackingEntry;

  async function handleToggleSave() {
    try {
      if (isSaved) {
        await unsave.mutateAsync(hackathonId);
        toast.show("Removed from saved", "success");
      } else {
        await save.mutateAsync(hackathonId);
        toast.show("Saved", "success");
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function handleMarkRegistered() {
    try {
      await updateStatus.mutateAsync({ hackathonId, status: "registered" });
      toast.show("Marked as registered", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to update status", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" style={{ color: PALETTE.mist }}>
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (isError || !hackathon) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle size={28} style={{ color: PALETTE.coral }} />
        <p className="text-sm font-medium" style={{ color: PALETTE.mist }}>
          {error instanceof Error ? error.message : "Hackathon not found."}
        </p>
        <Link href="/app/hackathons" className="text-sm font-bold hover:underline" style={{ color: PALETTE.violet }}>
          Back to hackathons
        </Link>
      </div>
    );
  }

  const urgency = calculateUrgency(hackathon.timeline.submissionDeadline);
  const daysLeft = daysUntil(hackathon.timeline.submissionDeadline);
  const accent = URGENCY_COLOR[urgency] ?? PALETTE.violet;

  // Real description field, straight from the synced source — never
  // fabricated. Some Devpost hackathons genuinely ship an empty tagline,
  // so when it's blank we say so honestly and point at the real listing
  // rather than leaving a silent gap or inventing filler copy.
  const hasDescription = hackathon.description.trim().length > 0;

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#FCFBFF" }}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/app/hackathons"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-bold transition-colors"
          style={{ color: PALETTE.mist }}
        >
          <ArrowLeft size={14} /> All hackathons
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-black leading-tight tracking-tight" style={{ color: PALETTE.ink }}>
              {hackathon.title}
            </h1>
            <p className="mt-1 text-sm font-bold uppercase tracking-wide" style={{ color: PALETTE.mist }}>
              {hackathon.organizer.name}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hackathon.themes.map((t, i) => {
                const c = TAG_COLORS[i % TAG_COLORS.length];
                return (
                  <span key={t} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: `${c}17`, color: c }}>
                    {t}
                  </span>
                );
              })}
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold capitalize" style={{ backgroundColor: PALETTE.ink, color: "#fff" }}>
                {hackathon.mode}
              </span>
              {hackathon.eligibility.map((e) => (
                <span
                  key={e}
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold capitalize"
                  style={{ border: `1.5px solid ${PALETTE.line}`, color: PALETTE.mist }}
                >
                  {e}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={handleToggleSave}
                disabled={save.isPending || unsave.isPending}
                className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition-shadow hover:shadow-[0_4px_14px_-4px_rgba(23,21,33,0.15)] disabled:opacity-50"
                style={{ border: `1.5px solid ${PALETTE.line}`, color: PALETTE.ink }}
              >
                {isSaved ? <BookmarkCheck size={16} style={{ color: PALETTE.violet }} /> : <Bookmark size={16} />}
                {isSaved ? "Saved" : "Save"}
              </button>
              <a
                href={hackathon.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: PALETTE.coral }}
              >
                Register <ExternalLink size={15} />
              </a>
            </div>
            {isSaved && trackingEntry?.status === "saved" && (
              <button
                onClick={handleMarkRegistered}
                disabled={updateStatus.isPending}
                className="flex items-center gap-1 text-xs font-bold hover:underline disabled:opacity-50"
                style={{ color: PALETTE.teal }}
              >
                <CheckCircle2 size={12} /> Mark as registered
              </button>
            )}
            {trackingEntry && trackingEntry.status !== "saved" && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold capitalize" style={{ backgroundColor: `${PALETTE.teal}17`, color: PALETTE.teal }}>
                {trackingEntry.status.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>

        <div
          className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-bold"
          style={{ backgroundColor: `${accent}12`, border: `1.5px solid ${accent}30`, color: accent }}
        >
          <span className="flex items-center gap-1.5">
            <Calendar size={14} /> Submission deadline: {formatDate(hackathon.timeline.submissionDeadline)}
            {daysLeft >= 0 && ` (${Math.floor(daysLeft)} days left)`}
          </span>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {hackathon.prizes.totalPoolUsd !== undefined && (
            <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${PALETTE.line}` }}>
              <div className="mb-1 flex items-center gap-1.5" style={{ color: PALETTE.mist }}>
                <Trophy size={13} style={{ color: PALETTE.sun }} />
                <span className="text-[11px] font-bold uppercase tracking-wide">Prize pool</span>
              </div>
              <p className="text-lg font-extrabold" style={{ color: PALETTE.ink }}>
                ${hackathon.prizes.totalPoolUsd.toLocaleString()}
              </p>
            </div>
          )}
          {hackathon.location && (
            <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${PALETTE.line}` }}>
              <div className="mb-1 flex items-center gap-1.5" style={{ color: PALETTE.mist }}>
                <MapPin size={13} style={{ color: PALETTE.violet }} />
                <span className="text-[11px] font-bold uppercase tracking-wide">Location</span>
              </div>
              <p className="text-sm font-bold" style={{ color: PALETTE.ink }}>{hackathon.location}</p>
            </div>
          )}
          {(hackathon.teamSizeMin || hackathon.teamSizeMax) && (
            <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${PALETTE.line}` }}>
              <div className="mb-1 flex items-center gap-1.5" style={{ color: PALETTE.mist }}>
                <Users size={13} style={{ color: PALETTE.teal }} />
                <span className="text-[11px] font-bold uppercase tracking-wide">Team size</span>
              </div>
              <p className="text-sm font-bold" style={{ color: PALETTE.ink }}>
                {hackathon.teamSizeMin ?? 1}–{hackathon.teamSizeMax ?? "?"} members
              </p>
            </div>
          )}
        </div>

        <Panel title="About">
          {hasDescription ? (
            <p className="whitespace-pre-line text-sm font-medium leading-relaxed" style={{ color: "#4B4859" }}>
              {hackathon.description}
            </p>
          ) : (
            <p className="text-sm font-medium leading-relaxed" style={{ color: PALETTE.mist }}>
              The organizer didn&apos;t publish a description for this hackathon.{" "}
              <a href={hackathon.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: PALETTE.violet }}>
                View the full listing
              </a>{" "}
              for details.
            </p>
          )}
        </Panel>

        {hackathon.prizes.tiers.length > 0 && (
          <Panel title="Prizes">
            <div className="space-y-2">
              {hackathon.prizes.tiers.map((tier, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm last:pb-0" style={{ borderBottom: i < hackathon.prizes.tiers.length - 1 ? `1px solid ${PALETTE.line}` : undefined }}>
                  <div>
                    <p className="font-bold" style={{ color: PALETTE.ink }}>{tier.label}</p>
                    {tier.description && <p className="text-xs font-medium" style={{ color: PALETTE.mist }}>{tier.description}</p>}
                  </div>
                  {tier.amountUsd !== undefined && (
                    <p className="font-extrabold" style={{ color: PALETTE.sun }}>${tier.amountUsd.toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {hackathon.technologies.length > 0 && (
          <Panel title="Technologies">
            <div className="flex flex-wrap gap-1.5">
              {hackathon.technologies.map((tech, i) => {
                const c = TAG_COLORS[i % TAG_COLORS.length];
                return (
                  <span key={tech} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: `${c}17`, color: c }}>
                    {tech}
                  </span>
                );
              })}
            </div>
          </Panel>
        )}

        <Panel title="Timeline">
          <div className="space-y-2.5 text-sm font-semibold">
            {hackathon.timeline.registrationOpensAt && (
              <div className="flex justify-between">
                <span style={{ color: PALETTE.mist }}>Registration opens</span>
                <span style={{ color: PALETTE.ink }}>{formatDate(hackathon.timeline.registrationOpensAt)}</span>
              </div>
            )}
            {hackathon.timeline.registrationClosesAt && (
              <div className="flex justify-between">
                <span style={{ color: PALETTE.mist }}>Registration closes</span>
                <span style={{ color: PALETTE.ink }}>{formatDate(hackathon.timeline.registrationClosesAt)}</span>
              </div>
            )}
            {hackathon.timeline.hackingStartsAt && (
              <div className="flex justify-between">
                <span style={{ color: PALETTE.mist }}>Hacking starts</span>
                <span style={{ color: PALETTE.ink }}>{formatDate(hackathon.timeline.hackingStartsAt)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: PALETTE.mist }}>Submission deadline</span>
              <span style={{ color: PALETTE.ink }}>{formatDate(hackathon.timeline.submissionDeadline)}</span>
            </div>
            {hackathon.timeline.resultsAt && (
              <div className="flex justify-between">
                <span style={{ color: PALETTE.mist }}>Results announced</span>
                <span style={{ color: PALETTE.ink }}>{formatDate(hackathon.timeline.resultsAt)}</span>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function HackathonDetailPage({ params }: { params: Promise<{ hackathonId: string }> }) {
  const { hackathonId } = use(params);
  return (
    <ToastProvider>
      <HackathonDetailContent hackathonId={decodeURIComponent(hackathonId)} />
    </ToastProvider>
  );
}
