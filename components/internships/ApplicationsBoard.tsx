"use client";

import Link from "next/link";
import { AlertTriangle, Inbox } from "lucide-react";
import type { ApplicationStatus } from "@/lib/internships/types";
import { useApplications } from "@/lib/internships-client/hooks";
import { ApplicationStatusControl } from "./ApplicationStatusControl";
import { formatStipend, formatLocation } from "@/lib/internships-client/format";
import { InternshipApiError } from "@/lib/internships-client/api";

const FUNNEL_ORDER: ApplicationStatus[] = [
  "saved", "applied", "interview_scheduled", "offer", "accepted", "rejected", "withdrawn",
];

const FUNNEL_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved", applied: "Applied", interview_scheduled: "Interview",
  rejected: "Rejected", offer: "Offer", accepted: "Accepted", withdrawn: "Withdrawn",
};

export function ApplicationsBoard() {
  const { data, isLoading, isError, error } = useApplications();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-panel h-20 animate-pulse rounded-2xl border border-border" />
        ))}
      </div>
    );
  }

  if (isError) {
    const message = error instanceof InternshipApiError ? error.message : "Couldn't load your applications.";
    return (
      <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl border border-danger/20 p-10 text-center">
        <AlertTriangle size={20} className="text-danger" />
        <p className="text-sm text-ink">{message}</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const funnel = data?.funnel;

  if (items.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl border border-border p-14 text-center">
        <Inbox size={22} className="text-mist" />
        <p className="text-sm font-medium text-ink">No applications tracked yet</p>
        <p className="max-w-xs text-xs text-mist">
          Save an internship or mark one as applied and it&apos;ll show up here with status tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {funnel && (
        <div className="flex flex-wrap gap-2">
          {FUNNEL_ORDER.filter((status) => funnel[status] > 0).map((status) => (
            <div
              key={status}
              className="rounded-full border border-border bg-surface/40 px-3 py-1.5 text-xs text-mist"
            >
              {FUNNEL_LABEL[status]} <span className="font-medium text-ink">{funnel[status]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {items.map(({ application, internship, daysUntilDeadline }) => (
          <div
            key={application.id}
            className="glass-panel flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <Link href={`/app/opportunities/${internship.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{internship.title}</p>
              <p className="truncate text-xs text-mist">
                {internship.company.name} · {formatLocation(internship.location)} · {formatStipend(internship.compensation)}
              </p>
              {daysUntilDeadline !== null && daysUntilDeadline >= 0 && (
                <p className="mt-1 text-[11px] text-mist">
                  {daysUntilDeadline === 0 ? "Deadline today" : `${daysUntilDeadline}d left to decide`}
                </p>
              )}
            </Link>
            <ApplicationStatusControl internshipId={internship.id} status={application.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
