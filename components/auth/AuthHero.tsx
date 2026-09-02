"use client";

import { motion } from "framer-motion";
import { Sparkles, BookOpen, Hammer, Rocket } from "lucide-react";

const ACCENT = "#5ff2ff";

const RING_SIZE = 248;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_VALUE = 94; // illustrative "readiness" score — the shape this app is built around

const CHIPS = [
  { icon: Sparkles, label: "Predict", pos: "left-[6%] top-[14%]", delay: 0 },
  { icon: BookOpen, label: "Learn", pos: "right-[8%] top-[24%]", delay: 0.6 },
  { icon: Hammer, label: "Build", pos: "left-[10%] bottom-[20%]", delay: 1.2 },
  { icon: Rocket, label: "Succeed", pos: "right-[4%] bottom-[12%]", delay: 1.8 },
];

export default function AuthHero() {
  return (
    <div className="relative hidden overflow-hidden bg-[#050505] lg:flex lg:flex-col lg:items-center lg:justify-center">
      {/* Ambient drifting glow */}
      <motion.div
        aria-hidden
        className="absolute h-[520px] w-[520px] rounded-full opacity-[0.14] blur-[110px]"
        style={{ backgroundColor: ACCENT }}
        animate={{ x: [-40, 40, -40], y: [-30, 20, -30] }}
        transition={{ duration: 16, ease: "easeInOut", repeat: Infinity }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.15) 0, transparent 0), radial-gradient(1px 1px at 70% 65%, rgba(255,255,255,0.12) 0, transparent 0), radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.1) 0, transparent 0), radial-gradient(1px 1px at 85% 20%, rgba(255,255,255,0.12) 0, transparent 0)",
          backgroundSize: "100% 100%",
        }}
      />

      <div className="relative flex flex-col items-center px-12">
        {/* Signature element: the prediction ring, floating chips */}
        <div className="relative flex h-[340px] w-[340px] items-center justify-center">
          {CHIPS.map(({ icon: Icon, label, pos, delay }) => (
            <motion.div
              key={label}
              className={`absolute ${pos} flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-xl`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: [0, -8, 0] }}
              transition={{
                opacity: { duration: 0.6, delay: 0.4 + delay * 0.15 },
                y: { duration: 4.5, ease: "easeInOut", repeat: Infinity, delay },
              }}
            >
              <Icon size={13} color={ACCENT} />
              <span className="text-[11px] font-medium text-white/70">{label}</span>
            </motion.div>
          ))}

          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="white"
              strokeOpacity={0.06}
              strokeWidth={RING_STROKE}
            />
            <motion.circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={ACCENT}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
              animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - RING_VALUE / 100) }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              style={{ filter: `drop-shadow(0 0 10px ${ACCENT}88)` }}
            />
          </svg>

          <div className="pointer-events-none absolute flex flex-col items-center">
            <span className="font-mono text-4xl font-semibold text-white" style={{ fontFamily: "var(--font-mono)" }}>
              {RING_VALUE}
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">Readiness</span>
          </div>
        </div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-4 max-w-sm text-center"
        >
          <span
            className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/35"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            The AI Operating System for Students
          </span>
          <h2
            className="mt-3 text-3xl font-medium leading-tight text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Predict. Learn.
            <br />
            Build. Succeed.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/45">
            One place for study, research, placements, and everything after — built to keep up
            with where you&apos;re headed.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
