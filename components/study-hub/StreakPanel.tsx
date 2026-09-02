"use client";

import { Flame } from "lucide-react";
import { useStudySessions } from "@/lib/study-hub-client/hooks";

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

export function StreakPanel() {
  const { data, isLoading, isError } = useStudySessions();

  if (isLoading) {
    return <div className="glass-panel h-40 animate-pulse rounded-2xl border border-border" />;
  }
  if (isError || !data) {
    return (
      <div className="glass-panel rounded-2xl border border-border p-5 text-sm text-mist">
        Couldn&apos;t load your study stats right now.
      </div>
    );
  }

  const { analytics } = data;
  const maxSeconds = Math.max(...analytics.dailyBreakdown.map((d) => d.seconds), 1);

  return (
    <div className="glass-panel rounded-2xl border border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={16} className={analytics.currentStreakDays > 0 ? "text-pulse" : "text-mist"} />
          <span className="text-sm font-medium text-ink">
            {analytics.currentStreakDays} day{analytics.currentStreakDays === 1 ? "" : "s"} streak
          </span>
        </div>
        <span className="text-xs text-mist">Best: {analytics.longestStreakDays}d</span>
      </div>

      <div className="mb-4 flex items-end gap-1.5">
        {analytics.dailyBreakdown.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-signal/60"
              style={{ height: `${Math.max(4, (d.seconds / maxSeconds) * 48)}px` }}
            />
            <span className="text-[9px] text-mist">{new Date(d.date).toLocaleDateString(undefined, { weekday: "narrow" })}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between border-t border-border pt-3 text-xs text-mist">
        <span>This week: {formatHours(analytics.totalSecondsThisWeek)}</span>
        <span>All time: {formatHours(analytics.totalSecondsAllTime)}</span>
      </div>
    </div>
  );
}
