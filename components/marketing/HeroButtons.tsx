"use client";

import { motion } from "framer-motion";

interface HeroButtonsProps {
  // Kept for backwards-compat with HeroText, no longer required to navigate.
  onBoot?: () => void;
  showSecondary?: boolean;
}

export default function HeroButtons({ showSecondary = true }: HeroButtonsProps) {
  return (
    <div className="mt-9 flex items-center justify-center gap-4">
      <motion.a
        href="/signup"
        whileHover={{ y: -2, boxShadow: "0 0 44px rgba(95,242,255,0.4)" }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[#5ff2ff] to-[#8de6ff] px-8 py-3.5 text-sm font-medium text-[#050505] shadow-[0_0_30px_rgba(95,242,255,0.25)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Boot Prophezy
      </motion.a>

      {showSecondary && (
        <a
          href="#modules"
          className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm text-[var(--dim)] transition-colors hover:border-white/30 hover:text-white"
        >
          Watch demo
        </a>
      )}
    </div>
  );
}
