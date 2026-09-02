"use client";

import { useEffect, useState } from "react";

const ACCENT = "#5ff2ff";

export default function ReadingProgressBar({ targetId }: { targetId: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const el = document.getElementById(targetId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [targetId]);

  return (
    <div className="fixed left-0 top-0 z-50 h-[2px] w-full bg-white/[0.04]">
      <div
        className="h-full transition-[width] duration-150"
        style={{ width: `${progress}%`, backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
      />
    </div>
  );
}
