"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { useInternshipNotifications, useMarkNotificationsRead } from "@/lib/internships-client/hooks";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useInternshipNotifications(false, 30);
  const markRead = useMarkNotificationsRead();

  const unreadCount = (data ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-mist transition-colors hover:border-signal/30 hover:text-ink"
        aria-label="Internship notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="glass-panel absolute right-0 top-full z-20 mt-2 max-h-96 w-80 overflow-y-auto rounded-2xl border border-border p-2 shadow-xl">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-mist">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markRead.mutate(undefined)}
                  className="flex items-center gap-1 text-[11px] text-signal hover:underline"
                >
                  <Check size={11} />
                  Mark all read
                </button>
              )}
            </div>

            {isLoading && <div className="p-4 text-center text-xs text-mist">Loading…</div>}

            {!isLoading && (data ?? []).length === 0 && (
              <div className="p-6 text-center text-xs text-mist">
                No notifications yet — you&apos;ll see new matches and deadline reminders here.
              </div>
            )}

            {(data ?? []).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.readAt) markRead.mutate([n.id]);
                  if (n.payload.url) window.location.href = n.payload.url;
                }}
                className={cn(
                  "block w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-ink/5",
                  !n.readAt && "bg-signal/[0.04]",
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{n.payload.title}</p>
                    <p className="truncate text-[11px] text-mist">{n.payload.body}</p>
                    <p className="mt-0.5 text-[10px] text-mist/70">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
