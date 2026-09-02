"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MapPin,
  Clock,
  ExternalLink,
  Share2,
  ArrowUpRight,
  Sparkles,
  CalendarClock,
  GraduationCap,
  Banknote,
  Lock,
  Unlock,
} from "lucide-react";
import type { InternshipRecord, MatchResult } from "@/lib/internships/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveButton } from "./SaveButton";
import { useUnlockApplication, useUnlockedUrl, useUnlockStatus } from "@/lib/internships-client/hooks";
import {
  formatStipend,
  formatDeadline,
  formatLocation,
  formatPostedAt,
  WORK_MODE_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  matchScoreTone,
} from "@/lib/internships-client/format";

interface InternshipCardProps {
  internship: InternshipRecord;
  /** From the recommendations feed. Falls back to internship.matchScore
   *  (set server-side on every search result) when not provided. */
  match?: MatchResult;
}

const PROVIDER_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  adzuna: "Adzuna",
  jooble: "Jooble",
  remoteok: "RemoteOK",
  remotive: "Remotive",
  weworkremotely: "We Work Remotely",
  themuse: "The Muse",
  arbeitnow: "Arbeitnow",
};

/**
 * company.logoUrl is null for most providers. Two independent fallback
 * sources, tried in order, before giving up to the letter avatar:
 *   1. Google's public favicon service — not a tracking domain, rarely
 *      appears on ad-blocker lists (unlike Clearbit, which often does).
 *   2. Clearbit's logo API — higher quality when it isn't blocked.
 * Returns an ARRAY of candidates; the component tries each on error.
 */
function resolveLogoCandidates(company: InternshipRecord["company"]): string[] {
  const candidates: string[] = [];
  if (company.logoUrl) candidates.push(company.logoUrl);
  if (company.domain) {
    candidates.push(`https://www.google.com/s2/favicons?domain=${company.domain}&sz=128`);
    candidates.push(`https://logo.clearbit.com/${company.domain}?size=128`);
  }
  return candidates;
}

export function InternshipCard({ internship, match }: InternshipCardProps) {
  const router = useRouter();
  const detailHref = `/app/opportunities/${internship.id}`;
  const deadline = formatDeadline(internship.deadlineAt);
  const [copied, setCopied] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);
  const logoCandidates = resolveLogoCandidates(internship.company);
  const logoUrl = logoCandidates[logoIndex];

  const matchScore = match?.recommendationScore ?? (internship as InternshipRecord & { matchScore?: number }).matchScore ?? null;
  const provider = internship.sources?.[0]?.provider;
  const eligibility = internship.eligibility;
  const eligibilityLine = [
    eligibility?.degrees?.length ? eligibility.degrees.join("/") : null,
    eligibility?.branches?.length ? eligibility.branches[0] : null,
  ]
    .filter(Boolean)
    .join(" — ");
  const durationLabel = internship.duration.raw ?? (internship.duration.months ? `${internship.duration.months} mo` : null);

  const unlock = useUnlockApplication();
  const unlockedUrl = useUnlockedUrl(internship.id);
  const isUnlocked = unlockedUrl !== null;
  // null = unlimited plan (Premium) or not loaded yet — never treat null
  // as "0 left"; only an actual 0 disables the button.
  const { data: unlockStatus } = useUnlockStatus();
  const atLimit = !isUnlocked && unlockStatus?.remaining === 0;

  const handleApply = (e: React.MouseEvent) => {
    // Never let the card's own Link swallow this — must open the provider's
    // exact original posting URL, in a new tab.
    e.preventDefault();
    e.stopPropagation();

    // Already unlocked this session — reopen the cached real URL instead
    // of calling POST /:id/unlock again, which would spend a second
    // credit and count a second time against the plan's monthly cap for
    // something already paid for.
    if (unlockedUrl) {
      window.open(unlockedUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // internship.applyUrl no longer exists on records from search/detail
    // (Phase 5 stripped it server-side — see toPublicInternship()). The
    // real URL now only comes from POST /:id/unlock, so it has to be
    // fetched first. window.open() runs from the mutation's onSuccess
    // rather than synchronously here; the alternative — pre-opening a
    // blank tab and setting its location once the URL comes back — would
    // require dropping noopener/noreferrer to keep a handle to that tab,
    // which is the exact tabnabbing protection this was written with in
    // the first place. This is a single fast POST with no external API
    // call inside it, so it stays well within the window browsers still
    // treat this as a trusted click for.
    unlock.mutate(internship.id, {
      onSuccess: (result) => {
        window.open(result.applyUrl, "_blank", "noopener,noreferrer");
      },
    });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/app/opportunities/${internship.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: internship.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // user cancelled the native share sheet — not an error
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(detailHref)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(detailHref);
        }
      }}
      className="glass-panel group relative flex min-h-[23rem] cursor-pointer flex-col gap-4 rounded-2xl border border-border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-glass"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface/60 text-sm font-semibold text-ink">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={logoUrl}
                src={logoUrl}
                alt=""
                className="h-full w-full object-contain p-1.5"
                onError={() => setLogoIndex((i) => i + 1)}
              />
            ) : (
              internship.company.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-[15px] font-medium leading-snug text-ink">
              {internship.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-mist">
              <span className="truncate">{internship.company.name}</span>
              {provider && (
                <>
                  <span className="text-mist/50">•</span>
                  <span className="shrink-0">{PROVIDER_LABEL[provider] ?? provider}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <SaveButton internshipId={internship.id} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {matchScore !== null && (
          <Badge tone={match ? matchScoreTone(matchScore) : "pulse"} className="w-fit gap-1">
            <Sparkles size={11} />
            {matchScore}% match
          </Badge>
        )}
        {/* Locked/Unlocked status — the real applyUrl only exists after a
            successful POST /:id/unlock (Phase 5); this badge reflects
            that server-confirmed state, never a client guess. */}
        <Badge
          tone={isUnlocked ? "success" : atLimit ? "danger" : "neutral"}
          className="w-fit gap-1"
          title={
            isUnlocked
              ? "You've unlocked this internship's real application link."
              : atLimit
                ? "You're out of unlocks for this period — upgrade for more."
                : "Click \"Unlock to Apply\" below to reveal the real application link. It stays unlocked for you afterward."
          }
        >
          {isUnlocked ? <Unlock size={11} /> : <Lock size={11} />}
          {isUnlocked ? "Unlocked" : atLimit ? "Limit reached" : "Locked"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-mist">
        <span className="flex items-center gap-1">
          <MapPin size={12} />
          {formatLocation(internship.location)}
        </span>
        <Badge tone="neutral">{WORK_MODE_LABEL[internship.workMode]}</Badge>
        <Badge tone="neutral">{EMPLOYMENT_TYPE_LABEL[internship.employmentType]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-border bg-surface/40 p-3 text-xs">
        <div className="flex items-center gap-1.5 text-mist">
          <Banknote size={12} className="shrink-0" />
          <span className="truncate text-ink">{formatStipend(internship.compensation)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-mist">
          <CalendarClock size={12} className="shrink-0" />
          <span
            className={
              "truncate " +
              (deadline.expired ? "text-mist" : deadline.urgent ? "font-medium text-danger" : "text-ink")
            }
          >
            {deadline.label}
          </span>
        </div>
        {durationLabel && (
          <div className="flex items-center gap-1.5 text-mist">
            <Clock size={12} className="shrink-0" />
            <span className="truncate text-ink">{durationLabel}</span>
          </div>
        )}
        {eligibilityLine && (
          <div className="flex items-center gap-1.5 text-mist">
            <GraduationCap size={12} className="shrink-0" />
            <span className="truncate text-ink">{eligibilityLine}</span>
          </div>
        )}
      </div>

      {internship.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {internship.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-mist">
              {skill}
            </span>
          ))}
          {internship.skills.length > 4 && (
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-mist">
              +{internship.skills.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[11px] text-mist">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {formatPostedAt(internship.postedAt)}
        </span>
        <span className="flex items-center gap-1 text-signal opacity-0 transition-opacity group-hover:opacity-100">
          View details <ArrowUpRight size={12} />
        </span>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {atLimit ? (
          <Link
            href="/#pricing"
            onClick={(e) => e.stopPropagation()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm font-medium text-mist"
            title="You've used all your internship unlocks for this period — upgrade for more."
          >
            Limit reached — Upgrade <Lock size={13} />
          </Link>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleApply}
            disabled={unlock.isPending}
            title={
              isUnlocked
                ? "Reopen the real application link."
                : "Reveals this internship's real application link — counts once against your monthly unlock allowance, then stays unlocked for you."
            }
          >
            {unlock.isPending ? (
              "Unlocking…"
            ) : isUnlocked ? (
              <>
                Apply Now <ExternalLink size={13} />
              </>
            ) : (
              <>
                Unlock to Apply <Lock size={13} />
              </>
            )}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
          <Share2 size={13} />
          {copied ? "Copied" : "Share"}
        </Button>
      </div>
    </div>
  );
}
