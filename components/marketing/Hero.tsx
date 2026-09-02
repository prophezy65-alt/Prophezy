"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useScroll } from "framer-motion";
import BackgroundEffects from "./BackgroundEffects";
import HeroText from "./HeroText";
import Navbar from "./Navbar";
import { useBootSequence } from "@/lib/useBootSequence";
import { useWorldScroll } from "@/lib/useWorldScroll";
import { useHeroCanvasFade } from "@/lib/useHeroCanvasFade";

// react-three-fiber's renderer needs real browser/WebGL APIs — it must
// never run during server-side rendering, or the reconciler crashes trying
// to read React internals that don't exist in the server bundle.
const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

const SECTION_COUNT = 6; // hero + 4 worlds + closing

export default function Hero() {
  const { booted, bootNow } = useBootSequence();
  const sectionRefs = useRef<Array<HTMLElement | null>>(Array(SECTION_COUNT).fill(null));
  const railIdxRef = useRef<HTMLSpanElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const registerSection = (index: number) => (el: HTMLElement | null) => {
    sectionRefs.current[index] = el;
  };

  useWorldScroll(sectionRefs, railIdxRef);
  useHeroCanvasFade(heroRef, canvasWrapRef);

  const { scrollYProgress } = useScroll();

  return (
    <div id="top" ref={heroRef} className="relative bg-[#050505] text-white">
      <BackgroundEffects />
      <div ref={canvasWrapRef} style={{ opacity: 1 }}>
        <HeroCanvas sectionRefs={sectionRefs} />
      </div>
      <Navbar booted={booted} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={booted ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.1, delay: 0.3 }}
        style={{ pointerEvents: "none" }}
        className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-between px-11 py-9"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => window.scrollBy({ top: window.innerHeight, behavior: "smooth" })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
            }
          }}
          style={{ pointerEvents: booted ? "auto" : "none" }}
          className="cursor-pointer text-right text-[10px] uppercase leading-relaxed tracking-[0.16em] text-[var(--dim)] focus:outline-none"
        >
          Scroll to open the OS
          <br />
          <span ref={railIdxRef} className="text-[var(--wc,#5ff2ff)]" style={{ fontFamily: "var(--font-mono)" }}>
            00
          </span>{" "}
          / 04 modules
        </div>
        <div
          style={{ pointerEvents: "none" }}
          className="relative h-[120px] w-0.5 overflow-hidden rounded-full bg-white/[0.08]"
        >
          <motion.div
            style={{ scaleY: scrollYProgress, backgroundColor: "var(--wc, #5ff2ff)" }}
            className="absolute inset-x-0 top-0 h-full origin-top rounded-full"
          />
        </div>
      </motion.div>

      <HeroText registerSection={registerSection} onBoot={bootNow} />
    </div>
  );
}
