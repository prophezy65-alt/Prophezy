"use client";

/**
 * app/projects/page.tsx
 *
 * Real, database-backed project library. Zero AI anywhere in this page —
 * search/filter/pagination all hit /api/project-library, which only ever
 * queries Supabase. See lib/project-library/query.service.ts.
 *
 * Fonts: this page assumes "Space Grotesk" (display), "Inter" (body), and
 * "JetBrains Mono" (data tags/eyebrows) are available as --font-display,
 * --font-body, --font-mono. Add this to your root layout's <head> if you
 * haven't already:
 *
 *   <link rel="preconnect" href="https://fonts.googleapis.com" />
 *   <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
 *
 * and set the CSS variables (e.g. in globals.css):
 *   :root {
 *     --font-display: 'Space Grotesk', sans-serif;
 *     --font-body: 'Inter', sans-serif;
 *     --font-mono: 'JetBrains Mono', monospace;
 *   }
 * This file's own <style jsx global> block below does this automatically
 * if you'd rather not touch globals.css — remove it if you already set
 * these variables elsewhere.
 */

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ProjectLibraryCard from "./ProjectLibraryCard";
import { useProjectLibrary, useProjectLibraryFilterOptions, type LibraryFilters } from "./useProjectLibraryApi";

const DIFFICULTIES: { value: LibraryFilters["difficulty"]; label: string }[] = [
  { value: null, label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-xs font-medium uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A36] ${
        active
          ? "border-[#FF5A36] bg-[#FF5A36]/10 text-[#FF5A36]"
          : "border-white/[0.08] bg-white/[0.02] text-[#9A99A6] hover:border-white/[0.16] hover:text-[#F3F1EC]"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<LibraryFilters["difficulty"]>(null);
  const [page, setPage] = useState(1);

  const filters: LibraryFilters = { search, domain, difficulty };
  const { items, totalPages, totalCount, isLoading, error } = useProjectLibrary(filters, page);
  const { domains } = useProjectLibraryFilterOptions();

  function updateFilter<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-[#0B0B0F] font-[family-name:var(--font-body)]">
      <style jsx global>{`
        :root {
          --font-display: "Space Grotesk", sans-serif;
          --font-body: "Inter", sans-serif;
          --font-mono: "JetBrains Mono", monospace;
        }
      `}</style>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/[0.06] px-6 pb-14 pt-16 sm:px-10">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(600px_300px_at_15%_0%,rgba(255,90,54,0.10),transparent)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-[#FF5A36]">
            <Sparkles size={12} /> {totalCount || "1,826"} repos · 0 generated
          </div>
          <h1 className="mb-3 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.05] tracking-tight text-[#F3F1EC] sm:text-5xl">
            Every project here is <span className="text-[#FF5A36]">real.</span>
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-[#9A99A6]">
            {totalCount || "1,826"} GitHub repositories, verified one by one. Real code, real tech stacks, real
            links — nothing generated, nothing invented.
          </p>

          <div className="relative mt-8 max-w-xl">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B8A96]" />
            <input
              type="text"
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Search by title, tech stack, or skill..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#131318] py-3.5 pl-11 pr-4 text-sm text-[#F3F1EC] placeholder:text-[#8B8A96] focus:outline-none focus:ring-2 focus:ring-[#FF5A36]/50"
            />
          </div>
        </div>
      </div>

      {/* Filters + grid */}
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-10">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) =>
              d.value === null ? (
                <Pill key={d.label} active={difficulty === null} onClick={() => updateFilter(setDifficulty, null)}>
                  {d.label}
                </Pill>
              ) : (
                <Pill
                  key={d.label}
                  active={difficulty === d.value}
                  onClick={() => updateFilter(setDifficulty, difficulty === d.value ? null : d.value)}
                >
                  {d.label}
                </Pill>
              )
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill active={domain === null} onClick={() => updateFilter(setDomain, null)}>
              All domains
            </Pill>
            {domains.slice(0, 12).map((d) => (
              <Pill key={d} active={domain === d} onClick={() => updateFilter(setDomain, domain === d ? null : d)}>
                {d}
              </Pill>
            ))}
          </div>
        </div>

        {!isLoading && !error && (
          <p className="mb-5 font-mono text-xs uppercase tracking-wide text-[#8B8A96]">
            {totalCount} project{totalCount === 1 ? "" : "s"} found
          </p>
        )}

        {error && <p className="mb-4 text-sm text-red-400">Couldn't load projects: {error}</p>}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-[#131318]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#131318] p-10 text-center">
            <p className="text-sm text-[#9A99A6]">Nothing matches those filters yet. Try a broader search or a different domain.</p>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AnimatePresence>
              {items.map((project) => (
                <ProjectLibraryCard key={project.id} project={project} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-white/[0.08] px-4 py-2 font-mono text-xs uppercase tracking-wide text-[#9A99A6] transition-colors hover:border-white/[0.16] hover:text-[#F3F1EC] disabled:opacity-30"
            >
              Prev
            </button>
            <span className="font-mono text-xs text-[#8B8A96]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-white/[0.08] px-4 py-2 font-mono text-xs uppercase tracking-wide text-[#9A99A6] transition-colors hover:border-white/[0.16] hover:text-[#F3F1EC] disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
