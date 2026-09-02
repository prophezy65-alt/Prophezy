"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

const ACCENT = "#5ff2ff";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border"
        style={{ borderColor: `${ACCENT}33`, background: `radial-gradient(circle at 50% 30%, ${ACCENT}14, rgba(5,5,5,0.6))` }}
      >
        <Icon size={26} style={{ color: ACCENT }} strokeWidth={1.6} />
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ boxShadow: `0 0 30px ${ACCENT}22` }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-lg font-medium text-white"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        This module is under construction
      </motion.p>

      {description && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24 }}
          className="mt-4 max-w-sm text-sm leading-relaxed text-white/50"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
