"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRecommendations } from "@/lib/internships-client/hooks";
import { InternshipCard } from "./InternshipCard";
import { Button } from "@/components/ui/button";

export function RecommendationsSection() {
  const { data, isLoading, isError, refetch, isFetching } = useRecommendations(12);
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["internships", "recommendations"] });
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-panel h-44 animate-pulse rounded-2xl border border-border" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-panel rounded-2xl border border-border p-8 text-center text-sm text-mist">
        Couldn&apos;t load recommendations right now.
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl border border-border p-10 text-center">
        <Sparkles size={20} className="text-signal" />
        <p className="text-sm text-ink">No recommendations yet.</p>
        <p className="max-w-xs text-xs text-mist">
          Complete your profile (skills, degree, branch, preferences) so the AI has something to match against.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-mist">Ranked by fit with your profile and resume.</p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-mist hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((bundle) => (
          <InternshipCard key={bundle.internship.id} internship={bundle.internship} match={bundle.match} />
        ))}
      </div>
    </div>
  );
}
