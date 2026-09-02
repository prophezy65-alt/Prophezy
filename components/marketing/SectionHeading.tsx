"use client";

import { motion } from "framer-motion";

interface SectionHeadingProps {
  index: string;
  tag: string;
  title: string;
  description?: string;
  color?: string;
  align?: "left" | "center";
}

export default function SectionHeading({
  index,
  tag,
  title,
  description,
  color = "#5ff2ff",
  align = "left",
}: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`mb-14 max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}
    >
      <div
        className={`mb-4 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.12em] ${
          align === "center" ? "justify-center" : ""
        }`}
        style={{ color, fontFamily: "var(--font-mono)" }}
      >
        <span className="opacity-50">{index}</span>
        {tag}
      </div>
      <h2
        className="text-[clamp(28px,4vw,48px)] font-medium leading-[1.1] tracking-tight text-white"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-[15px] font-light leading-relaxed text-[var(--dim)]">{description}</p>
      )}
    </motion.div>
  );
}
