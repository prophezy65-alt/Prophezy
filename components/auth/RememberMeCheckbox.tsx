"use client";

const ACCENT = "#5ff2ff";

interface RememberMeCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function RememberMeCheckbox({ checked, onChange }: RememberMeCheckboxProps) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-white/50">
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-4 w-4 cursor-pointer appearance-none rounded border border-white/20 bg-white/[0.02] transition-colors checked:border-transparent"
          style={{ accentColor: ACCENT }}
        />
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="pointer-events-none absolute h-4 w-4 scale-0 text-[#050505] transition-transform peer-checked:scale-100"
        >
          <rect width="16" height="16" rx="4" fill={ACCENT} />
          <path d="M4.5 8.2 6.8 10.5 11.5 5.5" stroke="#050505" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Remember me
    </label>
  );
}
