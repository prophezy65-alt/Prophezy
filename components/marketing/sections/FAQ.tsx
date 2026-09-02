"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SectionHeading from "../SectionHeading";

const ACCENT = "#5ff2ff";

const FAQS = [
  {
    q: "Does Prophezy replace ChatGPT for studying?",
    a: "It replaces the need to copy-paste between ChatGPT and everything else. The AI already has context on your notes, projects and research — so answers are grounded in what you're actually working on, not a blank chat window.",
  },
  {
    q: "Can I import my existing notes and resume?",
    a: "Yes. Bring in PDFs, docs, or paste content directly — the knowledge graph and resume builder both index it automatically on import.",
  },
  {
    q: "Is my data used to train models?",
    a: "No. Your notes, projects and applications stay private to your account and are never used for model training.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You can export everything — notes, resumes, project history — at any time. Nothing is locked in.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative border-t border-white/[0.06] px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-3xl">
        <SectionHeading index="11" tag="FAQ" title="Questions, answered." color={ACCENT} align="center" />

        <div className="space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-sm font-medium text-white"
                >
                  {item.q}
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="shrink-0 text-lg leading-none"
                    style={{ color: ACCENT }}
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm font-light leading-relaxed text-[var(--dim)]">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
