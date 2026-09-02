"use client";

import { motion } from "framer-motion";
import SectionHeading from "../SectionHeading";

const ACCENT = "#3fe8c4";

const NODES = [
  { x: 260, y: 60 }, { x: 90, y: 120 }, { x: 400, y: 130 },
  { x: 200, y: 200 }, { x: 350, y: 240 }, { x: 60, y: 260 },
  { x: 460, y: 60 }, { x: 260, y: 300 },
];

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 5], [2, 4], [3, 4], [3, 5], [4, 7], [6, 2], [5, 7],
];

const FEATURES = [
  "Every paper and dataset you open joins one live knowledge graph.",
  "Ask a question — it already cites the sources it read.",
  "Auto-summarizes long papers into the three claims that matter.",
];

export default function ResearchLab() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] px-6 py-28 sm:py-36">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <div>
          <SectionHeading
            index="06"
            tag="Research Lab"
            title="It reads everything so you don't have to reread it."
            color={ACCENT}
          />
          <ul className="space-y-4">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-3 text-sm font-light leading-relaxed text-[var(--dim)]"
              >
                <span
                  className="mt-2 h-1 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }}
                />
                {f}
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7 }}
          className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-4"
        >
          <svg viewBox="0 0 520 340" className="h-auto w-full">
            {EDGES.map(([a, b], i) => (
              <motion.line
                key={i}
                x1={NODES[a]!.x} y1={NODES[a]!.y}
                x2={NODES[b]!.x} y2={NODES[b]!.y}
                stroke={ACCENT}
                strokeWidth={1}
                strokeOpacity={0.25}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.05 }}
              />
            ))}
            {NODES.map((n, i) => (
              <motion.circle
                key={i}
                cx={n.x} cy={n.y} r={5}
                fill={ACCENT}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: [0.4, 1, 0.6] }}
                viewport={{ once: true }}
                transition={{ duration: 2, delay: i * 0.15, repeat: Infinity, repeatType: "reverse" }}
              />
            ))}
          </svg>
        </motion.div>
      </div>
    </section>
  );
}
