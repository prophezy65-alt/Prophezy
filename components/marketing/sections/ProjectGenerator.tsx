"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import SectionHeading from "../SectionHeading";

const ACCENT = "#4d8dff";

const LINES = [
  "$ prophezy generate --brief \"expense tracker for students\"",
  "→ scaffolding Next.js + Postgres schema",
  "→ generating auth, budgets, receipts models",
  "→ writing API routes (12 files)",
  "→ done in 41s",
];

export default function ProjectGenerator() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines >= LINES.length) return;
    const t = setTimeout(() => setVisibleLines((v) => v + 1), 550);
    return () => clearTimeout(t);
  }, [visibleLines]);

  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] px-6 py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(${ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <SectionHeading
          index="09"
          tag="AI Project Generator"
          title="Describe it. Watch it get built."
          description="Blueprints, schema, and code scaffolding generate in real time as you describe what you're building — a real workspace, not a chat window."
          color={ACCENT}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-white/10 bg-[#050505]/80 p-5 font-mono text-[13px]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <div className="mb-4 flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <div className="space-y-2">
            {LINES.slice(0, visibleLines).map((line, i) => (
              <motion.div
                key={line}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={i === 0 ? "text-white" : "text-[var(--dim)]"}
                style={i === 0 ? { color: ACCENT } : undefined}
              >
                {line}
              </motion.div>
            ))}
            {visibleLines < LINES.length && (
              <span className="inline-block h-3.5 w-1.5 animate-pulse" style={{ backgroundColor: ACCENT }} />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
