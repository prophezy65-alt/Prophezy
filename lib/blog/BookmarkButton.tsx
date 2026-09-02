"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";

const ACCENT = "#5ff2ff";
const KEY = "prophezy_bookmarks";

function readBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeBookmarks(slugs: string[]) {
  localStorage.setItem(KEY, JSON.stringify(slugs));
}

// Bookmarks are stored locally in the browser rather than in Supabase —
// there's no user auth wired up yet (per the plan to add auth last), and a
// per-account bookmark table without auth would just be a fake backend.
// This works immediately and can move server-side once accounts exist.
export default function BookmarkButton({ slug }: { slug: string }) {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setBookmarked(readBookmarks().includes(slug));
  }, [slug]);

  function toggle() {
    const current = readBookmarks();
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    writeBookmarks(next);
    setBookmarked(next.includes(slug));
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-xs transition-colors hover:border-white/20"
      style={{ fontFamily: "var(--font-mono)" }}
      aria-pressed={bookmarked}
    >
      <Bookmark size={13} fill={bookmarked ? ACCENT : "none"} stroke={bookmarked ? ACCENT : "currentColor"} />
      {bookmarked ? "Saved" : "Save"}
    </button>
  );
}
