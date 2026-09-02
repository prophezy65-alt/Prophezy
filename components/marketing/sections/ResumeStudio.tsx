"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SectionHeading from "../SectionHeading";

const ACCENT = "#9d6bff";

const ROLES = ["Software Engineer", "Data Analyst", "Product Intern", "ML Researcher"];
const SKILLS = [
  { label: "React / TypeScript", value: 92 },
  { label: "Systems Design", value: 78 },
  { label: "Applied ML", value: 85 },
];

export default function ResumeStudio() {
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setRoleIndex((i) => (i + 1) % ROLES.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] px-6 py-28 sm:py-36">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7 }}
          className="order-2 rounded-2xl border border-white/10 bg-white/[0.02] p-7 lg:order-1"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="h-2.5 w-24 rounded-full bg-white/10" />
            <AnimatePresence mode="wait">
              <motion.span
                key={ROLES[roleIndex]}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.3 }}
                className="rounded-full border px-3 py-1 text-[11px]"
                style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
              >
                {ROLES[roleIndex]}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="mb-6 h-3 w-40 rounded-full bg-white/[0.06]" />

          <div className="space-y-4">
            {SKILLS.map((s, i) => (
              <div key={s.label}>
                <div className="mb-1.5 flex justify-between text-[11px] text-[var(--dim)]">
                  <span>{s.label}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${s.value}%` }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 1, delay: i * 0.15, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-2 rounded-full bg-white/[0.05]" style={{ width: `${100 - i * 12}%` }} />
            ))}
          </div>
        </motion.div>

        <div className="order-1 lg:order-2">
          <SectionHeading
            index="07"
            tag="Resume Studio"
            title="One resume that rewrites itself for every role."
            description="Your projects, research and coursework are already in the system. Target a role and the resume reorders, reweights, and reframes itself around it — automatically."
            color={ACCENT}
          />
        </div>
      </div>
    </section>
  );
}
