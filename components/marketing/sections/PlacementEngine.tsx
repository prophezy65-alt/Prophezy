"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate, useReducedMotion, type Variants } from "framer-motion";
import SectionHeading from "../SectionHeading";

const ACCENT = "#ff7a45";

interface Signal {
  id: string;
  company: string;
  role: string;
  source: string;
  matchScore: number;
  status: "validated" | "rejected";
  rejectReason?: string;
  reasons?: string[];
}

const SIGNALS: Signal[] = [
  {
    id: "google-ml",
    company: "Google",
    role: "ML Engineering Intern",
    source: "Google Careers",
    matchScore: 96,
    status: "validated",
    reasons: ["Matches your AI/ML coursework", "Fits your Semester 5 timeline", "Overlaps with your recent projects"],
  },
  { id: "loopwork-design", company: "Loopwork", role: "Product Design Intern", source: "Unstop", matchScore: 90, status: "validated" },
  { id: "razorpay-be", company: "Razorpay", role: "Backend Engineering Intern", source: "LinkedIn Jobs", matchScore: 88, status: "validated" },
  { id: "microsoft-cloud", company: "Microsoft", role: "Cloud Engineering Intern", source: "Microsoft Careers", matchScore: 85, status: "validated" },
  { id: "github-fellow", company: "GitHub", role: "Open Source Fellow", source: "GitHub", matchScore: 83, status: "validated" },
  {
    id: "amazon-ops",
    company: "Amazon",
    role: "Warehouse Ops Intern",
    source: "Amazon Careers",
    matchScore: 35,
    status: "rejected",
    rejectReason: "deadline already passed",
  },
  {
    id: "coldline-sales",
    company: "Coldline Co",
    role: "Outbound Sales Role",
    source: "Official Career Page",
    matchScore: 28,
    status: "rejected",
    rejectReason: "doesn't match your skills",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Ambient particle field — a deterministic phyllotaxis (golden-angle) point
// distribution, not random noise. Positions are pre-computed and rounded so
// server and client always render the identical string (Math.cos/sin can
// differ in the last float bit across environments otherwise, which causes
// a hydration mismatch).
// ─────────────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 46;
const GOLDEN_ANGLE = 137.508;

function buildParticles(n: number) {
  const pts: { id: number; x: number; y: number; size: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = i * GOLDEN_ANGLE;
    const radius = Math.sqrt(i / n) * 46;
    const rad = (angle * Math.PI) / 180;
    const x = Math.round((50 + radius * Math.cos(rad)) * 1000) / 1000;
    const y = Math.round((50 + radius * Math.sin(rad) * 0.5) * 1000) / 1000;
    pts.push({ id: i, x, y, size: 1.4 + (i % 3) * 0.5 });
  }
  return pts;
}
const PARTICLES = buildParticles(PARTICLE_COUNT);

const PHASES = ["wake", "connect", "scan", "reject", "rank", "reveal"] as const;
type Phase = (typeof PHASES)[number];

const PHASE_DURATION: Record<Phase, number> = {
  wake: 2200,
  connect: 3600,
  scan: 3400,
  reject: 3400,
  rank: 3200,
  reveal: 5200,
};

const CONNECT_SOURCES = [
  { text: "Internshala", x: 14, y: 22 },
  { text: "LinkedIn Jobs", x: 84, y: 20 },
  { text: "GitHub", x: 10, y: 76 },
  { text: "Google Careers", x: 86, y: 74 },
  { text: "Microsoft Careers", x: 50, y: 10 },
  { text: "Amazon Careers", x: 50, y: 90 },
];

const REJECT_TOKENS = SIGNALS.filter((s) => s.status === "rejected").map((s, i) => ({
  text: `${s.company} — ${s.role}`,
  reason: s.rejectReason ?? "",
  x: i === 0 ? 18 : 78,
  y: i === 0 ? 28 : 70,
}));

const panelListVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.15 } },
};
const panelItemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

function ParticleField({ phase }: { phase: Phase }) {
  const convergence = phase === "reveal" ? 0.55 : phase === "rank" ? 0.22 : 0;
  const baseOpacity = phase === "scan" ? 0.55 : phase === "reveal" ? 0.16 : 0.3;
  return (
    <div className="pointer-events-none absolute inset-0">
      {PARTICLES.map((p, i) => {
        const tx = p.x + (50 - p.x) * convergence;
        const ty = p.y + (50 - p.y) * convergence;
        return (
          <motion.div
            key={p.id}
            className="absolute"
            animate={{ left: `${tx}%`, top: `${ty}%`, opacity: baseOpacity }}
            transition={{ duration: 1.6, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <motion.span
              className="block rounded-full"
              style={{ width: p.size, height: p.size, backgroundColor: ACCENT }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3.4 + (i % 4) * 0.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function ConnectTokens({ phase }: { phase: Phase }) {
  return (
    <AnimatePresence>
      {phase === "connect" &&
        CONNECT_SOURCES.map((t, i) => (
          <motion.div
            key={t.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, delay: i * 0.2 }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs"
            style={{ left: `${t.x}%`, top: `${t.y}%`, color: `${ACCENT}bb`, fontFamily: "var(--font-mono)" }}
          >
            {t.text}
          </motion.div>
        ))}
    </AnimatePresence>
  );
}

function RejectTokens({ phase }: { phase: Phase }) {
  return (
    <AnimatePresence>
      {phase === "reject" &&
        REJECT_TOKENS.map((t, i) => (
          <motion.div
            key={t.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.6, delay: i * 0.3 }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center"
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
          >
            <div className="text-xs text-white/40 line-through" style={{ fontFamily: "var(--font-mono)" }}>
              {t.text}
            </div>
            <div className="mt-0.5 text-[10px] text-red-400/60">{t.reason}</div>
          </motion.div>
        ))}
    </AnimatePresence>
  );
}

function ConfidenceCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.3,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);
  return <>{display}</>;
}

function RankStack({ items }: { items: Signal[] }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      {items.map((s, i) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1 - i * 0.14, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, delay: i * 0.2 }}
          className="text-sm text-white/70"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {s.company} — {s.role} <span style={{ color: ACCENT }}>{s.matchScore}%</span>
        </motion.div>
      ))}
    </div>
  );
}

function RevealBlock({ topPick }: { topPick: Signal }) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 text-[10px] uppercase tracking-[0.14em]" style={{ color: ACCENT, fontFamily: "var(--font-mono)" }}>
        Signal selected
      </div>
      <h3 className="text-[clamp(30px,5vw,52px)] font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        {topPick.company}
      </h3>
      <p className="mt-1 text-sm text-white/50">{topPick.role}</p>

      <div className="mt-6 flex items-baseline gap-1" style={{ fontFamily: "var(--font-mono)", color: ACCENT }}>
        <span className="text-[44px] font-medium">
          <ConfidenceCounter value={topPick.matchScore} />
        </span>
        <span className="text-base">% fit</span>
      </div>

      {topPick.reasons && (
        <motion.ul variants={panelListVariants} initial="hidden" animate="show" className="mt-6 space-y-1.5">
          {topPick.reasons.map((r) => (
            <motion.li key={r} variants={panelItemVariants} className="text-xs text-white/55">
              {r}
            </motion.li>
          ))}
        </motion.ul>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="mt-7 flex items-center gap-1.5 text-xs"
        style={{ fontFamily: "var(--font-mono)", color: ACCENT }}
      >
        Open Original Source
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
    </div>
  );
}

function PhaseContent({
  phase,
  validatedSorted,
  topPick,
}: {
  phase: Phase;
  validatedSorted: Signal[];
  topPick: Signal;
}) {
  if (phase === "reveal") return <RevealBlock topPick={topPick} />;

  if (phase === "rank") {
    const rest = validatedSorted.filter((s) => s.id !== topPick.id);
    return (
      <div className="flex flex-col items-center">
        <h3 className="mb-6 text-[clamp(22px,3.4vw,32px)] font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
          Ranking what&apos;s left.
        </h3>
        <RankStack items={rest} />
      </div>
    );
  }

  const copy: Record<"wake" | "connect" | "scan" | "reject", { headline: string; sub?: string }> = {
    wake: { headline: "Prophezy is waking up." },
    connect: { headline: "Connecting to your sources.", sub: "Internshala · LinkedIn · GitHub · Google · Microsoft · Amazon" },
    scan: { headline: "Scanning thousands of live opportunities.", sub: "1,240 found across 11 platforms" },
    reject: { headline: "Discarding what doesn't fit you." },
  };
  const c = copy[phase];

  return (
    <div>
      <h3 className="text-[clamp(24px,4.2vw,44px)] font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        {c.headline}
      </h3>
      {c.sub && (
        <p className="mt-3 text-xs text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          {c.sub}
        </p>
      )}
    </div>
  );
}

export default function PlacementEngine() {
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(prefersReduced ? "reveal" : "wake");

  const validatedSorted = useMemo(
    () => SIGNALS.filter((s) => s.status === "validated").sort((a, b) => b.matchScore - a.matchScore),
    []
  );
  const topPick = validatedSorted[0]!;

  useEffect(() => {
    if (prefersReduced) return;
    let idx = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      idx = (idx + 1) % PHASES.length;
      setPhase(PHASES[idx]!);
      timer = setTimeout(advance, PHASE_DURATION[PHASES[idx]!]);
    };
    timer = setTimeout(advance, PHASE_DURATION[PHASES[0]]);
    return () => clearTimeout(timer);
  }, [prefersReduced]);

  return (
    <section id="intelligence" className="relative overflow-hidden border-t border-white/[0.06] px-6 py-28 sm:py-36">
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          index="08"
          tag="AI Opportunity Discovery"
          title="Not a page. A process."
          description="An AI subsystem wakes up, connects to Internshala, LinkedIn, GitHub, Google, Microsoft and Amazon's own career pages, searches continuously, rejects what doesn't fit, and explains exactly why the rest made the cut. You always apply on the original source."
          color={ACCENT}
        />

        <div className="relative mx-auto mt-6 min-h-[560px] sm:min-h-[620px]">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: `radial-gradient(circle, ${ACCENT}12, transparent 70%)` }}
          />

          <ParticleField phase={phase} />
          <ConnectTokens phase={phase} />
          <RejectTokens phase={phase} />

          <div className="relative z-10 flex min-h-[560px] flex-col items-center justify-center px-4 text-center sm:min-h-[620px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
              >
                <PhaseContent phase={phase} validatedSorted={validatedSorted} topPick={topPick} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <p className="relative z-10 mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-white/40">
          Prophezy discovers. It never employs. Every application is completed on the original platform — Internshala,
          LinkedIn, Wellfound, GitHub, or the company&apos;s own careers page.
        </p>
      </div>
    </section>
  );
}
