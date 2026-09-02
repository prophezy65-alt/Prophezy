"use client";

import { motion } from "framer-motion";
import SectionHeading from "../SectionHeading";

const ACCENT = "#5ff2ff";

const TOOL_LABELS = ["Notes", "Flashcards", "Calendar", "PDF Reader", "Chat", "To-Do"];

// Evenly spaced around a circle so labels never collide with each other
// or with the center tile — start far out, settle in a clear ring around it.
const START_RADIUS = 340;
const REST_RADIUS = 190;

const SCATTERED_TOOLS = TOOL_LABELS.map((label, i) => {
  const angle = (i / TOOL_LABELS.length) * Math.PI * 2 - Math.PI / 2;
  return {
    label,
    startX: Math.cos(angle) * START_RADIUS,
    startY: Math.sin(angle) * START_RADIUS * 0.7,
    restX: Math.cos(angle) * REST_RADIUS,
    restY: Math.sin(angle) * REST_RADIUS * 0.7,
  };
});

export default function AIStudyHub() {
  return (
    <section id="modules" className="relative overflow-hidden border-t border-white/[0.06] px-6 py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(95,242,255,0.5) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      <div className="mx-auto max-w-6xl">
        <SectionHeading
          index="05"
          tag="AI Study Hub"
          title="Every study tool. One tile."
          description="Notes, flashcards, calendar, PDFs and chat used to live in five different tabs. Now they're one surface — and the AI already knows everything you've put into it."
          color={ACCENT}
        />

        <div className="relative mx-auto flex h-[460px] max-w-3xl items-center justify-center">
          {/* converging tool tiles — settle into a clear ring around the core, never behind it */}
          {SCATTERED_TOOLS.map((tool, i) => (
            <motion.div
              key={tool.label}
              initial={{ x: tool.startX, y: tool.startY, opacity: 0 }}
              whileInView={{ x: tool.restX, y: tool.restY, opacity: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 1.1, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute z-20 whitespace-nowrap rounded-xl border border-white/15 bg-[#0a0a0a]/90 px-4 py-2.5 text-xs font-medium text-white/90 shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md"
            >
              {tool.label}
            </motion.div>
          ))}

          {/* central core tile */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative z-30 flex h-40 w-40 flex-col items-center justify-center rounded-2xl border"
            style={{
              borderColor: "rgba(95,242,255,0.35)",
              background: "radial-gradient(circle at 50% 30%, rgba(95,242,255,0.14), rgba(5,5,5,0.6))",
              boxShadow: "0 0 60px rgba(95,242,255,0.15)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }}
            />
            <span
              className="mt-3 text-sm font-medium text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Prophezy
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--dim)]">
              one surface
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
