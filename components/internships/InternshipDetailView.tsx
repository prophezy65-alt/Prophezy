"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  MapPin, Clock, ExternalLink, Loader2, AlertTriangle, ArrowLeft,
  CheckCircle2, XCircle, GraduationCap, Briefcase, Lock,
} from "lucide-react";
import {
  useInternshipDetail,
  useApplications,
  useTransitionApplication,
  useUnlockApplication,
  useUnlockedUrl,
  useUnlockStatus,
} from "@/lib/internships-client/hooks";
import { InternshipCard } from "./InternshipCard";
import { SaveButton } from "./SaveButton";
import { ApplicationStatusControl } from "./ApplicationStatusControl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InternshipApiError } from "@/lib/internships-client/api";
import {
  formatStipend, formatDeadline, formatLocation, formatPostedAt,
  WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL, matchScoreTone,
} from "@/lib/internships-client/format";

export function InternshipDetailView({ internshipId }: { internshipId: string }) {
  const { data, isLoading, isError, error } = useInternshipDetail(internshipId);
  const { data: applications } = useApplications();
  const transition = useTransitionApplication();
  const queryClient = useQueryClient();
  const [logoFailed, setLogoFailed] = useState(false);

  const unlock = useUnlockApplication();
  const unlockedUrl = useUnlockedUrl(internshipId);
  const isUnlocked = unlockedUrl !== null;
  const { data: unlockStatus } = useUnlockStatus();
  const atLimit = !isUnlocked && unlockStatus?.remaining === 0;

  useEffect(() => {
    // The detail API route already records the view server-side on every
    // load — this just tells the "Recently Viewed" tab to refetch instead
    // of waiting out its normal staleTime.
    void queryClient.invalidateQueries({ queryKey: ["internships", "recently-viewed"] });
  }, [internshipId, queryClient]);

  const existingApplication = applications?.items.find((a) => a.internship.id === internshipId)?.application;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={22} className="animate-spin text-mist" />
      </div>
    );
  }

  if (isError || !data) {
    const message = error instanceof InternshipApiError ? error.message : "Couldn't load this internship.";
    return (
      <div className="glass-panel mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-danger/20 p-10 text-center">
        <AlertTriangle size={22} className="text-danger" />
        <p className="text-sm text-ink">{message}</p>
        <Link href="/app/opportunities" className="text-xs text-signal hover:underline">
          Back to Opportunity Scanner
        </Link>
      </div>
    );
  }

  const { internship, match, similar } = data;
  const deadline = formatDeadline(internship.deadlineAt);
  const durationLabel = internship.duration.raw ?? (internship.duration.months ? `${internship.duration.months} months` : "Not specified");

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/opportunities" className="mb-5 flex items-center gap-1.5 text-xs text-mist hover:text-ink">
        <ArrowLeft size={13} />
        Back to Opportunity Scanner
      </Link>

      <div className="glass-panel rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface/60 text-lg font-semibold text-ink">
              {internship.company.logoUrl || internship.company.domain ? (
                !logoFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={internship.company.logoUrl ?? `https://logo.clearbit.com/${internship.company.domain}?size=128`}
                    alt=""
                    className="h-full w-full object-contain p-2"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  internship.company.name.charAt(0).toUpperCase()
                )
              ) : (
                internship.company.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-medium text-ink">{internship.title}</h1>
              <p className="text-sm text-mist">{internship.company.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SaveButton internshipId={internship.id} />
            {atLimit ? (
              <Link
                href="/#pricing"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/40 px-3.5 py-2 text-sm font-medium text-mist"
                title="You've used all your internship unlocks for this period — upgrade for more."
              >
                Limit reached — Upgrade <Lock size={14} />
              </Link>
            ) : (
              <Button
                variant="primary"
                disabled={unlock.isPending}
                onClick={() => {
                  // internship.applyUrl doesn't exist on this record — it's
                  // stripped server-side until unlocked (same as search/card
                  // results). Already-unlocked-this-session just reopens the
                  // cached real URL for free instead of re-spending a credit.
                  if (unlockedUrl) {
                    window.open(unlockedUrl, "_blank", "noopener,noreferrer");
                    if (!existingApplication || existingApplication.status === "saved") {
                      transition.mutate({ internshipId: internship.id, status: "applied" });
                    }
                    return;
                  }
                  unlock.mutate(internship.id, {
                    onSuccess: (result) => {
                      window.open(result.applyUrl, "_blank", "noopener,noreferrer");
                      if (!existingApplication || existingApplication.status === "saved") {
                        transition.mutate({ internshipId: internship.id, status: "applied" });
                      }
                    },
                  });
                }}
              >
                {unlock.isPending ? (
                  "Unlocking…"
                ) : isUnlocked ? (
                  <>
                    Apply on {internship.sources[0]?.provider ?? "source"} <ExternalLink size={14} />
                  </>
                ) : (
                  <>
                    Unlock to Apply on {internship.sources[0]?.provider ?? "source"} <Lock size={14} />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {match && (
            <Badge tone={matchScoreTone(match.recommendationScore)}>{match.recommendationScore}% match</Badge>
          )}
          <Badge tone="neutral">{WORK_MODE_LABEL[internship.workMode]}</Badge>
          <Badge tone="neutral">{EMPLOYMENT_TYPE_LABEL[internship.employmentType]}</Badge>
          {existingApplication && (
            <ApplicationStatusControl internshipId={internship.id} status={existingApplication.status} />
          )}
          <Badge tone={deadline.expired ? "neutral" : deadline.urgent ? "danger" : "neutral"}>
            {deadline.expired ? deadline.label : `Apply before: ${deadline.label}`}
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-mist">Location</p>
            <p className="mt-1 flex items-center gap-1 text-ink"><MapPin size={13} />{formatLocation(internship.location)}</p>
          </div>
          <div>
            <p className="text-xs text-mist">Stipend</p>
            <p className="mt-1 text-ink">{formatStipend(internship.compensation)}</p>
          </div>
          <div>
            <p className="text-xs text-mist">Duration</p>
            <p className="mt-1 text-ink">{durationLabel}</p>
          </div>
          <div>
            <p className="text-xs text-mist">Posted</p>
            <p className="mt-1 flex items-center gap-1 text-ink"><Clock size={13} />{formatPostedAt(internship.postedAt)}</p>
          </div>
        </div>
      </div>

      {match && (
        <div className="glass-panel mt-5 rounded-2xl border border-border p-6">
          <h2 className="mb-4 font-display text-base font-medium text-ink">Why this matches you</h2>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Resume match", value: match.resumeMatch },
              { label: "ATS match", value: match.atsMatch },
              { label: "Eligibility", value: match.eligibilityScore },
              { label: "Readiness", value: match.applicationReadiness },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-border bg-surface/40 p-3">
                <p className="text-xs text-mist">{m.label}</p>
                <p className="mt-1 text-lg font-medium text-ink">{m.value}%</p>
              </div>
            ))}
          </div>

          {match.explanation.summary && <p className="mb-4 text-sm text-ink">{match.explanation.summary}</p>}

          {match.matchedSkills.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 size={13} /> Matched skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {match.matchedSkills.map((s) => (
                  <span key={s} className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] text-success">{s}</span>
                ))}
              </div>
            </div>
          )}

          {match.missingSkills.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-mist">
                <XCircle size={13} /> Skills to build
              </p>
              <div className="flex flex-wrap gap-1.5">
                {match.missingSkills.map((s) => (
                  <span key={s} className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] text-mist">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="glass-panel mt-5 rounded-2xl border border-border p-6">
        <h2 className="mb-3 font-display text-base font-medium text-ink">About this role</h2>

        {/*
          Rendering descriptionHtml instead of the flattened plain-text
          `description` — the employer's original posting HTML already has
          proper <h2>/<h3>/<ul> structure (Responsibilities, Minimum
          requirements, Preferred qualifications, etc.), which is what was
          actually requested rather than a "Responsibilities" field that
          doesn't exist anywhere in NormalizedInternship. Falls back to the
          plain-text description if descriptionHtml is missing for a given
          posting (some providers don't supply it).

          CAVEAT: this is third-party HTML pulled from each provider's job
          board and rendered with dangerouslySetInnerHTML. If
          normalizer.service.ts / the ATS providers don't already sanitize
          it server-side before it reaches the `internships` table, this is
          an XSS surface. I have not verified that sanitization happens
          upstream — worth confirming (or adding a DOMPurify pass either at
          normalize-time or here) before shipping this to production.
        */}
        {internship.descriptionHtml ? (
          <div
            className="prose-detail text-sm leading-relaxed text-ink/90
              [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-ink
              [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:font-display [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-ink
              [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_a]:text-signal [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: internship.descriptionHtml }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{internship.description}</p>
        )}

        {internship.skills.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-mist">Required skills</p>
            <div className="flex flex-wrap gap-1.5">
              {internship.skills.map((s) => (
                <span key={s} className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] text-mist">{s}</span>
              ))}
            </div>
          </div>
        )}

        {(internship.eligibility.degrees.length > 0 ||
          internship.eligibility.branches.length > 0 ||
          internship.eligibility.minCgpa) && (
          <div className="mt-5 flex items-start gap-2">
            <GraduationCap size={14} className="mt-0.5 shrink-0 text-mist" />
            <div className="text-xs text-mist">
              {internship.eligibility.degrees.length > 0 && <p>Degrees: {internship.eligibility.degrees.join(", ")}</p>}
              {internship.eligibility.branches.length > 0 && <p>Branches: {internship.eligibility.branches.join(", ")}</p>}
              {internship.eligibility.minCgpa && <p>Minimum CGPA: {internship.eligibility.minCgpa}</p>}
              {internship.eligibility.notes.map((note, i) => <p key={i}>{note}</p>)}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 text-xs text-mist">
          <Briefcase size={13} />
          Sourced via {internship.sources.map((s) => s.provider).join(", ")}
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-base font-medium text-ink">Similar internships</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {similar.map((item) => (
              <InternshipCard key={item.id} internship={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
