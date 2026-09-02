"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import type { HackathonFilters, HackathonMode, ExperienceTier } from "@/lib/hackathons/models/hackathon.model";
import type { HackathonSort } from "@/lib/hackathons/services/hackathon.service";

const PALETTE = {
  ink: "#171521",
  mist: "#726F82",
  line: "#EDEBF5",
  coral: "#FF5A4E",
  teal: "#17C3A6",
  violet: "#6C4FE0",
  sun: "#D99A00",
};

const MODES: HackathonMode[] = ["online", "offline", "hybrid"];
const MODE_COLOR: Record<HackathonMode, string> = { online: PALETTE.teal, offline: PALETTE.violet, hybrid: PALETTE.coral };

const TIERS: ExperienceTier[] = ["beginner", "intermediate", "advanced"];
const TIER_COLOR: Record<ExperienceTier, string> = { beginner: PALETTE.sun, intermediate: PALETTE.coral, advanced: PALETTE.violet };

const SORTS: { value: HackathonSort; label: string }[] = [
  { value: "deadline_asc", label: "Deadline: Soonest" },
  { value: "deadline_desc", label: "Deadline: Latest" },
  { value: "prize_desc", label: "Prize: Highest" },
  { value: "newest", label: "Recently added" },
];

interface FilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  filters: HackathonFilters;
  onFiltersChange: (f: HackathonFilters) => void;
  sort: HackathonSort;
  onSortChange: (s: HackathonSort) => void;
}

export default function FilterBar({ query, onQueryChange, filters, onFiltersChange, sort, onSortChange }: FilterBarProps) {
  function toggleMode(mode: HackathonMode) {
    const current = filters.mode ?? [];
    const next = current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode];
    onFiltersChange({ ...filters, mode: next.length ? next : undefined });
  }

  function toggleTier(tier: ExperienceTier) {
    const current = filters.experienceTier ?? [];
    const next = current.includes(tier) ? current.filter((t) => t !== tier) : [...current, tier];
    onFiltersChange({ ...filters, experienceTier: next.length ? next : undefined });
  }

  const hasActiveFilters = !!(filters.mode?.length || filters.experienceTier?.length || filters.minPrizePoolUsd);

  return (
    <div className="mb-7 space-y-3.5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: PALETTE.mist }} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search hackathons by name, theme, or technology..."
            className="h-12 w-full rounded-full bg-white pl-11 pr-4 text-sm font-medium outline-none transition-colors placeholder:font-normal"
            style={{ border: `2px solid ${PALETTE.line}`, color: PALETTE.ink }}
            onFocus={(e) => (e.currentTarget.style.borderColor = PALETTE.violet)}
            onBlur={(e) => (e.currentTarget.style.borderColor = PALETTE.line)}
          />
        </div>

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as HackathonSort)}
          className="h-12 rounded-full bg-white px-5 text-sm font-bold outline-none"
          style={{ border: `2px solid ${PALETTE.line}`, color: PALETTE.ink }}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: PALETTE.mist }}>
          <SlidersHorizontal size={12} /> Filters
        </span>

        {MODES.map((mode) => {
          const active = filters.mode?.includes(mode);
          const c = MODE_COLOR[mode];
          return (
            <button
              key={mode}
              onClick={() => toggleMode(mode)}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition-all"
              style={
                active
                  ? { backgroundColor: c, color: "#fff", boxShadow: `0 4px 10px -3px ${c}80` }
                  : { border: `1.5px solid ${PALETTE.line}`, color: PALETTE.mist }
              }
            >
              {mode}
            </button>
          );
        })}

        <span className="mx-1 h-4 w-px" style={{ backgroundColor: PALETTE.line }} />

        {TIERS.map((tier) => {
          const active = filters.experienceTier?.includes(tier);
          const c = TIER_COLOR[tier];
          return (
            <button
              key={tier}
              onClick={() => toggleTier(tier)}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition-all"
              style={
                active
                  ? { backgroundColor: c, color: "#fff", boxShadow: `0 4px 10px -3px ${c}80` }
                  : { border: `1.5px solid ${PALETTE.line}`, color: PALETTE.mist }
              }
            >
              {tier}
            </button>
          );
        })}

        <span className="mx-1 h-4 w-px" style={{ backgroundColor: PALETTE.line }} />

        <input
          type="number"
          min={0}
          placeholder="Min prize $"
          value={filters.minPrizePoolUsd ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, minPrizePoolUsd: e.target.value ? Number(e.target.value) : undefined })}
          className="h-8 w-28 rounded-full bg-white px-3.5 text-xs font-semibold outline-none placeholder:font-normal"
          style={{ border: `1.5px solid ${PALETTE.line}`, color: PALETTE.ink }}
        />

        {hasActiveFilters && (
          <button
            onClick={() => onFiltersChange({})}
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors"
            style={{ color: PALETTE.coral }}
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
