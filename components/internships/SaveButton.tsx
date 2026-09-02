"use client";

import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsSaved, useToggleSaved } from "@/lib/internships-client/hooks";

interface SaveButtonProps {
  internshipId: string;
  className?: string;
}

export function SaveButton({ internshipId, className }: SaveButtonProps) {
  const isSaved = useIsSaved(internshipId);
  const toggle = useToggleSaved();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ internshipId, isSaved });
      }}
      disabled={toggle.isPending}
      aria-pressed={isSaved}
      aria-label={isSaved ? "Remove from saved" : "Save internship"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
        isSaved
          ? "border-signal/40 bg-signal/10 text-signal"
          : "border-border text-mist hover:border-signal/40 hover:text-signal",
        className,
      )}
    >
      <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} strokeWidth={1.8} />
    </button>
  );
}
