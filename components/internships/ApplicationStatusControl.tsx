"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { ApplicationStatus } from "@/lib/internships/types";
import { Badge } from "@/components/ui/badge";
import { useTransitionApplication } from "@/lib/internships-client/hooks";
import { cn } from "@/lib/utils";

// Mirrors the server-side transition table in lib/internships/services/tracking.service.ts —
// kept in sync manually since the engine doesn't export it as a shared constant.
// If the server rejects a transition anyway, the mutation's onError still surfaces it via toast.
const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  saved: ["applied", "withdrawn"],
  applied: ["interview_scheduled", "rejected", "offer", "withdrawn"],
  interview_scheduled: ["offer", "rejected", "withdrawn"],
  rejected: [],
  offer: ["accepted", "rejected", "withdrawn"],
  accepted: ["withdrawn"],
  withdrawn: [],
};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview_scheduled: "Interview scheduled",
  rejected: "Rejected",
  offer: "Offer received",
  accepted: "Accepted",
  withdrawn: "Withdrawn",
};

const STATUS_TONE: Record<ApplicationStatus, "signal" | "success" | "danger" | "neutral" | "pulse"> = {
  saved: "neutral",
  applied: "signal",
  interview_scheduled: "pulse",
  rejected: "danger",
  offer: "success",
  accepted: "success",
  withdrawn: "neutral",
};

interface ApplicationStatusControlProps {
  internshipId: string;
  status: ApplicationStatus;
}

export function ApplicationStatusControl({ internshipId, status }: ApplicationStatusControlProps) {
  const [open, setOpen] = useState(false);
  const transition = useTransitionApplication();
  const nextOptions = TRANSITIONS[status];

  if (nextOptions.length === 0) {
    return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={transition.isPending}
        className="flex items-center gap-1.5 disabled:opacity-60"
      >
        <Badge tone={STATUS_TONE[status]}>
          {transition.isPending ? <Loader2 size={11} className="animate-spin" /> : null}
          {STATUS_LABEL[status]}
        </Badge>
        <ChevronDown size={13} className="text-mist" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="glass-panel absolute left-0 top-full z-20 mt-1.5 w-48 rounded-xl border border-border p-1.5 shadow-lg">
            {nextOptions.map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => {
                  transition.mutate({ internshipId, status: next });
                  setOpen(false);
                }}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-xs text-ink transition-colors hover:bg-ink/5",
                )}
              >
                Move to {STATUS_LABEL[next]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
