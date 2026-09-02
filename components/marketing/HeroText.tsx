"use client";

import { motion } from "framer-motion";
import { WORLDS } from "@/lib/constants";
import HeroButtons from "./HeroButtons";

interface HeroTextProps {
  registerSection: (index: number) => (el: HTMLElement | null) => void;
  onBoot: () => void;
}

export default function HeroText({ registerSection, onBoot }: HeroTextProps) {
  return (
    <div className="relative z-10">
      {/* section 0 — hero */}
      <section
        ref={registerSection(0)}
        className="flex h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p className="mb-5 text-xs font-normal uppercase tracking-[0.32em] text-[#5ff2ff]">
          The AI Operating System
        </p>
        <h1
          className="text-[clamp(38px,6.2vw,80px)] font-medium leading-[1.04] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Stop Switching.
          <br />
          Start Building.
        </h1>
        <p className="mx-auto mt-5 max-w-[420px] text-[15px] font-light leading-relaxed text-[var(--dim)]">
          Study. Build. Research. Get Hired. — one intelligence, replacing the fifteen tabs
          you have open right now.
        </p>
        <HeroButtons onBoot={onBoot} />
      </section>

      {/* sections 1–4 — the four worlds */}
      {WORLDS.map((world, i) => (
        <section
          key={world.id}
          ref={registerSection(i + 1)}
          className={`flex h-screen items-center px-6 ${
            world.align === "left" ? "justify-start" : "justify-end"
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.5, once: false }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`max-w-[380px] text-left ${
              world.align === "left" ? "mr-auto pl-[8vw]" : "ml-auto pr-[8vw]"
            }`}
          >
            <div
              className="mb-4 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.12em]"
              style={{ color: world.color, fontFamily: "var(--font-mono)" }}
            >
              <span className="opacity-50">{String(world.index + 1).padStart(2, "0")}</span>
              {world.tag}
            </div>
            <h2
              className="mb-4 text-[clamp(28px,3.6vw,46px)] font-medium leading-[1.08] tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {world.title}
            </h2>
            <p className="max-w-[340px] text-sm font-light leading-relaxed text-[var(--dim)]">
              {world.description}
            </p>
          </motion.div>
        </section>
      ))}

      {/* section 5 — closing */}
      <section
        ref={registerSection(5)}
        className="flex h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p className="mb-5 text-xs uppercase tracking-[0.32em] text-[#5ff2ff]">
          One Workspace. Infinite Possibilities.
        </p>
        <h2
          className="text-[clamp(32px,5vw,64px)] font-medium leading-[1.04] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Your entire academic journey.
          <br />
          One intelligent system.
        </h2>
        <HeroButtons onBoot={onBoot} showSecondary={false} />
      </section>
    </div>
  );
}
