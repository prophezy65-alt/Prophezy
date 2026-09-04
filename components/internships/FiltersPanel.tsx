"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { InternshipFilters, WorkMode } from "@/lib/internships/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WORK_MODE_LABEL } from "@/lib/internships-client/format";
import { cn } from "@/lib/utils";

const WORK_MODES: WorkMode[] = ["remote", "hybrid", "onsite"];

/**
 * Country filter matches against the `country` column, which stores ISO-2
 * codes (confirmed from actual stored records — "IN", "US", "SG", etc.).
 * India is listed first since it's the default priority market; "Any" clears
 * the filter entirely rather than matching a literal value.
 */
const COUNTRIES: { code: string; label: string }[] = [
  { code: "", label: "Any country" },
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "SG", label: "Singapore" },
  { code: "AE", label: "UAE" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
];

interface FiltersPanelProps {
  open: boolean;
  onClose: () => void;
  filters: InternshipFilters;
  onChange: (filters: InternshipFilters) => void;
}

export function FiltersPanel({ open, onClose, filters, onChange }: FiltersPanelProps) {
  const [skillsDraft, setSkillsDraft] = useState(filters.skills?.join(", ") ?? "");

  if (!open) return null;

  const toggleWorkMode = (mode: WorkMode) => {
    const current = filters.workMode ?? [];
    const next = current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode];
    onChange({ ...filters, workMode: next.length ? next : undefined });
  };

  const activeCount = [
    filters.workMode?.length,
    filters.paid !== undefined,
    filters.minStipendInr,
    filters.country,
    filters.state,
    filters.city,
    filters.skills?.length,
  ].filter(Boolean).length;

  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-full max-w-sm rounded-2xl border-2 border-signal/40 bg-[#151420] p-5 shadow-2xl sm:right-0">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-medium text-ink">Filters</h3>
        <button type="button" onClick={onClose} className="text-mist hover:text-ink" aria-label="Close filters">
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <div>
          <label className="mb-2 block text-xs font-medium text-mist">Work mode</label>
          <div className="flex flex-wrap gap-2">
            {WORK_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => toggleWorkMode(mode)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  filters.workMode?.includes(mode)
                    ? "border-signal/40 bg-signal/10 text-signal"
                    : "border-border text-mist hover:border-signal/30",
                )}
              >
                {WORK_MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-mist">Compensation</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...filters, paid: filters.paid === true ? undefined : true })}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-xs transition-colors",
                filters.paid === true
                  ? "border-signal/40 bg-signal/10 text-signal"
                  : "border-border text-mist hover:border-signal/30",
              )}
            >
              Paid only
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...filters, paid: filters.paid === false ? undefined : false })}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-xs transition-colors",
                filters.paid === false
                  ? "border-signal/40 bg-signal/10 text-signal"
                  : "border-border text-mist hover:border-signal/30",
              )}
            >
              Unpaid OK
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-mist">Minimum stipend (₹/month)</label>
          <Input
            type="number"
            min={0}
            placeholder="e.g. 15000"
            value={filters.minStipendInr ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                minStipendInr: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-mist">Country</label>
            <select
              value={filters.country ?? ""}
              onChange={(e) => onChange({ ...filters, country: e.target.value || undefined })}
              className="h-11 w-full rounded-xl border border-border bg-surface/40 px-3 text-sm text-ink transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-mist">State</label>
            <Input
              placeholder="e.g. Karnataka"
              value={filters.state ?? ""}
              onChange={(e) => onChange({ ...filters, state: e.target.value || undefined })}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-mist">City</label>
          <Input
            placeholder="e.g. Bengaluru"
            value={filters.city ?? ""}
            onChange={(e) => onChange({ ...filters, city: e.target.value || undefined })}
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-mist">Skills (comma-separated)</label>
          <Input
            placeholder="e.g. React, Python"
            value={skillsDraft}
            onChange={(e) => setSkillsDraft(e.target.value)}
            onBlur={() =>
              onChange({
                ...filters,
                skills: skillsDraft
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => {
            setSkillsDraft("");
            onChange({ activeOnly: true });
          }}
          className="text-xs text-mist hover:text-ink"
        >
          Clear all{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        <Button variant="primary" size="sm" onClick={onClose}>
          Apply filters
        </Button>
      </div>
    </div>
  );
}