"use client";

import Link from "next/link";
import { X, Bookmark as BookmarkIcon } from "lucide-react";
import { useBookmarks, useRemoveBookmark } from "@/lib/study-hub-client/hooks";
import { ENTITY_DISPLAY } from "@/lib/study-hub-client/entity-display";

export function BookmarksSection() {
  const { data, isLoading, isError } = useBookmarks();
  const remove = useRemoveBookmark();

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
    return <p className="text-sm text-mist">Couldn&apos;t load bookmarks right now.</p>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl border border-border p-8 text-center">
        <BookmarkIcon size={18} className="text-mist" />
        <p className="text-sm text-mist">Nothing bookmarked yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((bookmark) => {
        const display = ENTITY_DISPLAY[bookmark.entityType];
        const Icon = display.icon;
        return (
          <div
            key={bookmark.id}
            className="glass-panel flex items-center gap-3 rounded-xl border border-border p-3"
          >
            <Icon size={15} className="shrink-0 text-signal" />
            <Link href={display.href(bookmark.entityId)} className="min-w-0 flex-1 text-sm text-ink hover:text-signal">
              {display.label}
            </Link>
            <button
              type="button"
              onClick={() => remove.mutate({ entityType: bookmark.entityType, entityId: bookmark.entityId })}
              disabled={remove.isPending}
              className="shrink-0 text-mist hover:text-danger disabled:opacity-50"
              aria-label="Remove bookmark"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
