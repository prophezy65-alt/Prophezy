"use client";

import { Search } from "lucide-react";

export default function Topbar() {
  const openPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/[0.07] bg-[#050505]/80 px-5 backdrop-blur-xl lg:px-8">
      <button
        type="button"
        onClick={openPalette}
        className="flex flex-1 items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2 text-sm text-white/40 transition-colors hover:border-white/20 sm:max-w-xs"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Search Prophezy…</span>
        <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/40 sm:inline">⌘K</kbd>
      </button>
    </header>
  );
}
