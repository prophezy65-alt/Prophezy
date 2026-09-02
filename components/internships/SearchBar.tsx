"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Debounces locally so every keystroke doesn't trigger a network request. */
export function SearchBar({ value, onChange, placeholder = "Search internships, companies, skills…" }: SearchBarProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className="relative flex-1">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="pl-11 pr-9"
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft("")}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-mist hover:text-ink"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
