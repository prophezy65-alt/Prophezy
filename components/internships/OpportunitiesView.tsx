"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, Radar, GraduationCap, Briefcase, Lock, Unlock } from "lucide-react";
import type { EmploymentType, InternshipFilters, SortKey } from "@/lib/internships/types";
import { useInternshipSearch, useSavedInternships, useRecentlyViewed, useUnlockStatus, useUnlockedInternships } from "@/lib/internships-client/hooks";
import { SearchBar } from "@/components/internships/SearchBar";
import { SortSelect } from "@/components/internships/SortSelect";
import { FiltersPanel } from "@/components/internships/FiltersPanel";
import { InternshipGrid } from "@/components/internships/InternshipGrid";
import { RecommendationsSection } from "@/components/internships/RecommendationsSection";
import { ApplicationsBoard } from "@/components/internships/ApplicationsBoard";
import { InternshipCard } from "@/components/internships/InternshipCard";
import { Button } from "@/components/ui/button";
import { InternshipApiError } from "@/lib/internships-client/api";
import { cn } from "@/lib/utils";

type Tab = "discover" | "saved" | "applications" | "recommended" | "recent" | "unlocked";
type Category = "internships" | "jobs";

const TABS: { id: Tab; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "recommended", label: "Recommended" },
  { id: "unlocked", label: "Unlocked" },
  { id: "saved", label: "Saved" },
  { id: "applications", label: "Applications" },
  { id: "recent", label: "Recently Viewed" },
];

const VALID_TABS: readonly Tab[] = TABS.map((t) => t.id);

/**
 * Internships and Jobs must never mix — this maps the two-way toggle onto
 * EmploymentType[] for the search filter. "Jobs" here means full-time /
 * contract roles; every internship-flavored employment type (internship,
 * apprenticeship, co-op, traineeship, fellowship) counts as "Internships".
 */
const CATEGORY_EMPLOYMENT_TYPES: Record<Category, EmploymentType[]> = {
  internships: ["internship", "apprenticeship", "co_op", "trainee", "fellowship"],
  jobs: ["full_time", "contract"],
};

function isValidTab(value: string | null): value is Tab {
  return value !== null && (VALID_TABS as readonly string[]).includes(value);
}

export function OpportunitiesView() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [category, setCategory] = useState<Category>("internships");
  const [tab, setTab] = useState<Tab>(isValidTab(requestedTab) ? requestedTab : "discover");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");
  const [filters, setFilters] = useState<InternshipFilters>({ activeOnly: true });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const effectiveFilters = useMemo<InternshipFilters>(
    () => ({ ...filters, employmentType: CATEGORY_EMPLOYMENT_TYPES[category] }),
    [filters, category],
  );

  const searchRequest = useMemo(
    () => ({ q: query || undefined, sort, filters: effectiveFilters, limit: 24 }),
    [query, sort, effectiveFilters],
  );

  const search = useInternshipSearch(searchRequest);
  const saved = useSavedInternships();
  // Always mounted (not gated behind the "unlocked" tab) so that every
  // card everywhere in the app — Discover, Saved, Recommended, etc. — has
  // its "Unlocked" badge correctly seeded from the durable server-side
  // list as soon as the page loads, not only once the Unlocked tab itself
  // is opened.
  const unlocked = useUnlockedInternships();
  // Recently-viewed is only ever rendered on the "recent" tab (unlike
  // `saved`, which InternshipCard's SaveButton also needs on every card in
  // Discover) — only fetch it once the user actually opens that tab,
  // instead of on every Opportunity Scanner page load.
  const recent = useRecentlyViewed(30, tab === "recent");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-signal/30 bg-signal/10 text-signal">
            <Radar size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-medium text-ink">Opportunity Scanner</h1>
            {/* Tagline/motto, replacing the old descriptive subtitle */}
            <p className="text-sm text-mist">
              Your next move, already predicted.
            </p>
          </div>
        </div>
      </div>

      {/* Internships / Jobs — top-level split, never mixed in results */}
      <div className="mb-5 inline-flex rounded-2xl border border-border bg-surface/40 p-1">
        <button
          type="button"
          onClick={() => setCategory("internships")}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            category === "internships" ? "bg-signal text-white" : "text-mist hover:text-ink",
          )}
        >
          <GraduationCap size={14} />
          Internships
        </button>
        <button
          type="button"
          onClick={() => setCategory("jobs")}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            category === "jobs" ? "bg-signal text-white" : "text-mist hover:text-ink",
          )}
        >
          <Briefcase size={14} />
          Jobs
        </button>
      </div>

      <div className="mb-6 flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "text-ink" : "text-mist hover:text-ink",
            )}
          >
            {t.label}
            {t.id === "saved" && (saved.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 text-xs text-mist">({saved.data?.length})</span>
            )}
            {t.id === "unlocked" && (unlocked.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 text-xs text-mist">({unlocked.data?.length})</span>
            )}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-signal" />}
          </button>
        ))}
      </div>

      {tab === "discover" && (
        <div>
          {category === "internships" && <UnlockStatusBanner />}
          <div className="relative mb-5 flex flex-wrap gap-3">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder={
                category === "jobs"
                  ? "Search jobs, companies, skills…"
                  : "Search internships, companies, skills…"
              }
            />
            <SortSelect value={sort} onChange={setSort} />
            <Button
              variant={filtersOpen ? "secondary" : "outline"}
              size="md"
              onClick={() => setFiltersOpen((v) => !v)}
              className="gap-1.5"
            >
              <SlidersHorizontal size={14} />
              Filters
            </Button>
            <FiltersPanel
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              filters={filters}
              onChange={setFilters}
            />
          </div>

          <InternshipGrid
            pages={search.data?.pages.map((p) => p.items)}
            isLoading={search.isLoading}
            isError={search.isError}
            error={search.error}
            hasNextPage={search.hasNextPage}
            isFetchingNextPage={search.isFetchingNextPage}
            fetchNextPage={() => void search.fetchNextPage()}
            onRetry={() => void search.refetch()}
            emptyTitle={
              query
                ? `No results for "${query}"`
                : category === "jobs"
                  ? "No jobs match these filters"
                  : "No internships match these filters"
            }
          />
        </div>
      )}

      {tab === "recommended" && <RecommendationsSection />}

      {tab === "unlocked" && (
        <div>
          {unlocked.isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-panel h-44 animate-pulse rounded-2xl border border-border" />
              ))}
            </div>
          )}
          {unlocked.isError && (
            <div className="glass-panel rounded-2xl border border-danger/20 p-8 text-center text-sm text-ink">
              {unlocked.error instanceof InternshipApiError ? unlocked.error.message : "Couldn't load your unlocked internships."}
            </div>
          )}
          {!unlocked.isLoading && !unlocked.isError && (unlocked.data?.length ?? 0) === 0 && (
            <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl border border-border p-14 text-center">
              <p className="text-sm font-medium text-ink">Nothing unlocked yet</p>
              <p className="max-w-xs text-xs text-mist">
                Internships you unlock will stay here permanently, so you can always find them again.
              </p>
            </div>
          )}
          {!unlocked.isLoading && (unlocked.data?.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {unlocked.data?.map((entry) => (
                <InternshipCard key={entry.internship.id} internship={entry.internship} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "saved" && (
        <div>
          {saved.isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-panel h-44 animate-pulse rounded-2xl border border-border" />
              ))}
            </div>
          )}
          {saved.isError && (
            <div className="glass-panel rounded-2xl border border-danger/20 p-8 text-center text-sm text-ink">
              {saved.error instanceof InternshipApiError ? saved.error.message : "Couldn't load saved internships."}
            </div>
          )}
          {!saved.isLoading && !saved.isError && (saved.data?.length ?? 0) === 0 && (
            <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl border border-border p-14 text-center">
              <p className="text-sm font-medium text-ink">Nothing saved yet</p>
              <p className="max-w-xs text-xs text-mist">
                Tap the bookmark icon on any internship to keep it here.
              </p>
            </div>
          )}
          {!saved.isLoading && (saved.data?.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {saved.data?.map((internship) => (
                <InternshipCard key={internship.id} internship={internship} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "applications" && <ApplicationsBoard />}

      {tab === "recent" && (
        <div>
          {recent.isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-panel h-44 animate-pulse rounded-2xl border border-border" />
              ))}
            </div>
          )}
          {recent.isError && (
            <div className="glass-panel rounded-2xl border border-danger/20 p-8 text-center text-sm text-ink">
              {recent.error instanceof InternshipApiError ? recent.error.message : "Couldn't load recently viewed internships."}
            </div>
          )}
          {!recent.isLoading && !recent.isError && (recent.data?.length ?? 0) === 0 && (
            <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl border border-border p-14 text-center">
              <p className="text-sm font-medium text-ink">Nothing viewed yet</p>
              <p className="max-w-xs text-xs text-mist">
                Internships you open will show up here, most recent first.
              </p>
            </div>
          )}
          {!recent.isLoading && (recent.data?.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recent.data?.map((internship) => (
                <InternshipCard key={internship.id} internship={internship} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * "You have X of Y internship unlocks left this month" — the piece that
 * was missing: without this, there was no way to see at a glance which
 * internships are still unlockable under your plan vs. which you're out
 * of allowance for. Reads the exact same server-confirmed number every
 * card's lock/unlock state is based on (useUnlockStatus), so this can
 * never say something different than what actually happens on click.
 */
function UnlockStatusBanner() {
  const { data, isLoading } = useUnlockStatus();
  if (isLoading || !data) return null;

  const { allowance, remaining } = data;
  const unlimited = allowance === null;

  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-1 rounded-xl border px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between",
        !unlimited && remaining === 0
          ? "border-danger/30 bg-danger/5 text-danger"
          : "border-border bg-surface/40 text-mist",
      )}
    >
      <div>
        <span className="flex items-center gap-2">
          {!unlimited && remaining === 0 ? <Lock size={14} /> : <Unlock size={14} />}
          {unlimited
            ? "Unlimited internship application unlocks on your plan"
            : `${remaining} of ${allowance} internship application unlocks left this month`}
        </span>
        {/* "Locked" alone reads as "you can't apply" rather than "click
            here to reveal the real link" — this line is what actually
            tells a first-time visitor what clicking the blue button does
            and that it's a one-time, permanent unlock, not a paywall
            block. */}
        <p className="mt-0.5 text-xs text-mist/70">
          Every internship starts Locked — click{" "}
          <span className="font-medium text-ink">Unlock to Apply</span> to reveal its real application
          link. Once unlocked, it stays unlocked for you.
        </p>
      </div>
      {!unlimited && remaining === 0 && (
        <a href="/#pricing" className="shrink-0 font-medium text-signal hover:underline">
          Upgrade for more
        </a>
      )}
    </div>
  );
}