"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Loader2, SearchX } from "lucide-react";
import type { InternshipRecord } from "@/lib/internships/types";
import { InternshipCard } from "./InternshipCard";
import { InternshipApiError } from "@/lib/internships-client/api";
import { Button } from "@/components/ui/button";

interface InternshipGridProps {
  pages: InternshipRecord[][] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onRetry: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

function CardSkeleton() {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-2xl border border-border p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-ink/10" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink/10" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-ink/10" />
        </div>
      </div>
      <div className="h-3 w-full animate-pulse rounded bg-ink/10" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-ink/10" />
    </div>
  );
}

export function InternshipGrid({
  pages,
  isLoading,
  isError,
  error,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onRetry,
  emptyTitle = "No internships match yet",
  emptyDescription = "Try widening your filters or searching a different role.",
}: InternshipGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // MOVED UP: this must run on every render, unconditionally, same as the
  // hooks above — it was previously placed after the isLoading/isError
  // early returns, which meant it was skipped entirely on loading/error
  // renders and only started firing once those conditions cleared. That's
  // a change in hook count between renders, which is exactly what React's
  // "change in the order of Hooks" error is about. Cheap to compute even
  // when pages is undefined (flat() on nothing just yields []), so there's
  // no downside to always running it.
  //
  // Defensive dedupe: pages come from independently-fetched, offset-based
  // requests. The diversified "relevance" ranking (see search.service.ts)
  // recomputes its ordering fresh on every page request from the top of the
  // ranked set — deterministic for a fixed dataset, but if a sync writes new
  // rows or updates quality_score between two page fetches, the ranking can
  // shift enough that an item legitimately appears in more than one page's
  // slice. This doesn't fix that underlying race (a real keyset-pagination
  // rewrite would), but it guarantees React never sees a duplicate key
  // regardless of which edge case produced it — first occurrence wins.
  const items = useMemo(() => {
    const flat = pages?.flat() ?? [];
    const seen = new Set<string>();
    const deduped: InternshipRecord[] = [];
    for (const item of flat) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      deduped.push(item);
    }
    return deduped;
  }, [pages]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    const message = error instanceof InternshipApiError ? error.message : "Something went wrong loading internships.";
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl border border-danger/20 p-10 text-center">
        <AlertTriangle size={22} className="text-danger" />
        <p className="text-sm text-ink">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl border border-border p-14 text-center">
        <SearchX size={24} className="text-mist" />
        <p className="text-sm font-medium text-ink">{emptyTitle}</p>
        <p className="max-w-xs text-xs text-mist">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((internship) => (
          <InternshipCard key={internship.id} internship={internship} />
        ))}
      </div>

      <div ref={sentinelRef} className="mt-6 flex justify-center py-4">
        {isFetchingNextPage && <Loader2 size={18} className="animate-spin text-mist" />}
        {!hasNextPage && items.length > 0 && (
          <p className="text-xs text-mist">You&apos;ve reached the end of the list.</p>
        )}
      </div>
    </div>
  );
}
