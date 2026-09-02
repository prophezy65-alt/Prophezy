"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useRecentlyViewed } from "@/lib/study-hub-client/hooks";
import { ENTITY_DISPLAY } from "@/lib/study-hub-client/entity-display";

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentlyViewedSection() {
  const { data, isLoading, isError } = useRecentlyViewed(undefined, 10);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-panel h-12 animate-pulse rounded-xl border border-border" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-mist">Couldn&apos;t load recently viewed items right now.</p>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl border border-border p-8 text-center">
        <History size={18} className="text-mist" />
        <p className="text-sm text-mist">Nothing viewed yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((view) => {
        const display = ENTITY_DISPLAY[view.entityType];
        const Icon = display.icon;
        return (
          <Link
            key={view.id}
            href={display.href(view.entityId)}
            className="glass-panel flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-signal/30"
          >
            <Icon size={15} className="shrink-0 text-mist" />
            <span className="min-w-0 flex-1 text-sm text-ink">{display.label}</span>
            <span className="shrink-0 text-xs text-mist">{timeAgo(view.viewedAt)}</span>
          </Link>
        );
      })}
    </div>
  );
}
