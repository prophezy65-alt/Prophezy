"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { AlertCircle, Bell, Loader2, Sparkles, Trophy, X } from "lucide-react";
import { ToastProvider } from "@/components/hackathons/Toast";
import HackathonCard from "@/components/hackathons/HackathonCard";
import FilterBar from "@/components/hackathons/FilterBar";
import {
  useHackathonsList,
  useHackathonSearch,
  useTrackedHackathons,
  useHackathonRecommendations,
  useHackathonNotifications,
  useDismissNotification,
} from "@/components/hackathons/useHackathonsApi";
import type { HackathonFilters, Hackathon } from "@/lib/hackathons/models/hackathon.model";
import type { HackathonSort } from "@/lib/hackathons/services/hackathon.service";

/**
 * Deliberately breaks from Prophezy's dark app shell for this page only —
 * white/near-white background, coral / teal / violet / amber accents.
 * Nothing here touches shared ui/* components or global styles, so the
 * rest of the app is unaffected.
 */
const PALETTE = {
  ink: "#171521",
  mist: "#726F82",
  line: "#EDEBF5",
  coral: "#FF5A4E",
  teal: "#17C3A6",
  violet: "#6C4FE0",
  sun: "#D99A00",
};

// Dark, stormy gradient background (per reference image) — replaces the
// flat white page background only. White cards/pills/filter bar keep
// their own dark-on-white text untouched; only text that sits directly
// on this backdrop (headings, empty/loading states) needs a light variant.
const PAGE_BG = "linear-gradient(180deg, #3C414B 0%, #1B1C21 42%, #0A0A0C 100%)";
const ON_DARK = { heading: "#F6F5FA", muted: "#A6A3B5" };

const REC_TILE_COLORS = [PALETTE.coral, PALETTE.violet, PALETTE.teal, "#D99A00"];

function HackathonsPageContent() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<HackathonFilters>({});
  const [sort, setSort] = useState<HackathonSort>("deadline_asc");
  const [showNotifications, setShowNotifications] = useState(false);

  const isSearching = query.trim().length > 0;

  const listQuery = useHackathonsList(filters, sort);
  const searchQuery = useHackathonSearch(query);
  const { data: saved } = useTrackedHackathons("saved");
  const { data: recommendations } = useHackathonRecommendations(6);
  const { data: notifications } = useHackathonNotifications();
  const dismissNotification = useDismissNotification();

  const savedIds = useMemo(() => new Set((saved ?? []).map((s) => s.hackathon.id)), [saved]);

  const listedHackathons = useMemo(() => {
    const pages = listQuery.data?.pages ?? [];
    return pages.flatMap((page) => {
      if (!Array.isArray(page?.items)) {
        console.warn("[hackathons] Skipping malformed page — missing items array:", page);
        return [];
      }
      return page.items;
    });
  }, [listQuery.data]);

  return (
    <div className="min-h-screen w-full rounded-[32px]" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-7 flex items-start justify-between">
          <div>
            <h1 className="text-[34px] font-black leading-none tracking-tight" style={{ color: ON_DARK.heading }}>
              Hackathons
            </h1>
            <span className="mt-2 block h-[5px] w-14 rounded-full" style={{ backgroundColor: PALETTE.coral }} />
            <p className="mt-3 text-sm font-medium" style={{ color: ON_DARK.muted }}>
              Discover hackathons and competitions worth your time.
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold transition-shadow hover:shadow-[0_4px_14px_-4px_rgba(23,21,33,0.15)]"
              style={{ border: `1.5px solid ${PALETTE.line}`, color: PALETTE.ink }}
            >
              <Bell size={16} style={{ color: PALETTE.violet }} />
              Reminders
              {notifications && notifications.length > 0 && (
                <span
                  className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: PALETTE.coral }}
                >
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                className="absolute right-0 top-full z-20 mt-2 max-h-96 w-80 overflow-y-auto rounded-2xl bg-white p-2 shadow-[0_16px_40px_-12px_rgba(23,21,33,0.25)]"
                style={{ border: `1.5px solid ${PALETTE.line}` }}
              >
                {(!notifications || notifications.length === 0) && (
                  <p className="px-3 py-6 text-center text-xs font-medium" style={{ color: PALETTE.mist }}>
                    No pending reminders.
                  </p>
                )}
                {(notifications ?? []).map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-2 rounded-xl px-3 py-2.5 hover:bg-[#FAFAFC]">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: PALETTE.ink }}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium" style={{ color: PALETTE.mist }}>
                        {new Date(n.triggerAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => dismissNotification.mutate(n.id)}
                      className="shrink-0 transition-colors"
                      style={{ color: PALETTE.mist }}
                      aria-label="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {recommendations && recommendations.length > 0 && !isSearching && (
          <div className="mb-7">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: ON_DARK.heading }}>
              <Sparkles size={15} style={{ color: "#B9A6FF" }} /> Recommended for you
            </div>
            <div className="flex gap-3.5 overflow-x-auto pb-2">
              {recommendations.map((rec, i) => {
                const tile = REC_TILE_COLORS[i % REC_TILE_COLORS.length];
                return (
                  <Link
                    key={rec.hackathonId}
                    href={`/app/hackathons/${encodeURIComponent(rec.hackathonId)}`}
                    className="w-72 shrink-0 rounded-3xl p-5 text-white transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: tile }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="line-clamp-1 text-[15px] font-extrabold">{rec.title}</h3>
                      <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold">
                        {rec.confidenceScore}%
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[12.5px] font-medium leading-relaxed text-white/85">{rec.rationale}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <FilterBar query={query} onQueryChange={setQuery} filters={filters} onFiltersChange={setFilters} sort={sort} onSortChange={setSort} />

        {isSearching ? (
          <SearchResults searchQuery={searchQuery} savedIds={savedIds} />
        ) : (
          <ListResults listQuery={listQuery} hackathons={listedHackathons} savedIds={savedIds} />
        )}
      </div>
    </div>
  );
}

function SearchResults({
  searchQuery,
  savedIds,
}: {
  searchQuery: ReturnType<typeof useHackathonSearch>;
  savedIds: Set<string>;
}) {
  if (searchQuery.isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center" style={{ color: ON_DARK.muted }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (searchQuery.isError) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-center">
        <AlertCircle size={24} style={{ color: PALETTE.coral }} />
        <p className="text-sm font-medium" style={{ color: ON_DARK.muted }}>
          {searchQuery.error instanceof Error ? searchQuery.error.message : "Search failed."}
        </p>
      </div>
    );
  }
  if (!searchQuery.data || searchQuery.data.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm font-medium" style={{ color: ON_DARK.muted }}>
        No results found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {searchQuery.data.map(({ hackathon }) => (
          <HackathonCard key={hackathon.id} hackathon={hackathon} isSaved={savedIds.has(hackathon.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ListResults({
  listQuery,
  hackathons,
  savedIds,
}: {
  listQuery: ReturnType<typeof useHackathonsList>;
  hackathons: Hackathon[];
  savedIds: Set<string>;
}) {
  if (listQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" style={{ color: ON_DARK.muted }}>
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle size={28} style={{ color: PALETTE.coral }} />
        <p className="text-sm font-medium" style={{ color: ON_DARK.muted }}>
          {listQuery.error instanceof Error ? listQuery.error.message : "Failed to load hackathons."}
        </p>
      </div>
    );
  }

  if (hackathons.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl" style={{ backgroundColor: "rgba(185,166,255,0.14)" }}>
          <Trophy size={26} strokeWidth={1.8} style={{ color: "#B9A6FF" }} />
        </div>
        <h2 className="text-lg font-extrabold" style={{ color: ON_DARK.heading }}>
          No hackathons found
        </h2>
        <p className="mt-2 max-w-sm text-sm font-medium" style={{ color: ON_DARK.muted }}>
          Try adjusting your filters, or check back soon — new hackathons are synced regularly.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {hackathons.map((hackathon) => (
            <HackathonCard key={hackathon.id} hackathon={hackathon} isSaved={savedIds.has(hackathon.id)} />
          ))}
        </AnimatePresence>
      </div>

      {listQuery.hasNextPage && (
        <div className="mt-7 flex justify-center">
          <button
            onClick={() => listQuery.fetchNextPage()}
            disabled={listQuery.isFetchingNextPage}
            className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold transition-shadow hover:shadow-[0_4px_14px_-4px_rgba(23,21,33,0.15)] disabled:opacity-60"
            style={{ border: `1.5px solid ${PALETTE.line}`, color: PALETTE.ink }}
          >
            {listQuery.isFetchingNextPage ? <Loader2 size={16} className="animate-spin" /> : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}

export default function HackathonsPage() {
  return (
    <ToastProvider>
      <HackathonsPageContent />
    </ToastProvider>
  );
}
