"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Full-page auth shell shared by every (auth) route.
 *
 * Deep, moody forest-green backdrop — a dark gradient, not a bright glow
 * mix — with a single centered translucent glass card. Restrained on
 * purpose: low glow intensity, muted tones, no "shining" blobs. In place
 * of a mascot, a small emerald orb badge sits above the card.
 */
export default function AuthCard({ title, subtitle, footer, children }: AuthCardProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-[#0a1410] px-6 py-10">
      <style>{`
        @keyframes auth-orb-pulse { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.04); opacity: 1; } }
        .auth-badge-pulse { animation: auth-orb-pulse 5s ease-in-out infinite; transform-origin: center; }
      `}</style>

      {/* ---------------- Deep, muted forest-green backdrop ---------------- */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, #0a1410 0%, #0f2318 45%, #11291c 65%, #0a1410 100%)",
          }}
        />
        {/* one soft, low-opacity glow — not a bright blob */}
        <div
          className="absolute left-1/2 top-[-10%] h-[520px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[140px]"
          style={{ backgroundColor: "#1f6b4a" }}
        />
        {/* vignette to keep edges dark and moody */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%, transparent 40%, #0a1410cc 100%)" }}
        />
      </div>

      {/* ---------------- Top-left wordmark ---------------- */}
      <div className="relative z-10 flex w-full max-w-6xl items-center">
        <Link href="/" className="flex items-center gap-2" style={{ fontFamily: "var(--font-mono)" }}>
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#34d399", boxShadow: "0 0 6px #34d399" }}
          />
          <span className="text-sm tracking-wide text-white/85">PROPHEZY</span>
        </Link>
      </div>

      {/* ---------------- Centered card ---------------- */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-10">
        {/* Minimal emerald orb badge — subtle, not glaring */}
        <div className="auth-badge-pulse relative mb-6 h-14 w-14">
          <div
            className="absolute inset-0 rounded-full opacity-40 blur-md"
            style={{ background: "conic-gradient(from 180deg, #34d399, #0d9488, #34d399)" }}
          />
          <div
            className="absolute inset-[3px] rounded-full"
            style={{ background: "radial-gradient(circle at 35% 30%, #6ee7b7, #10b981 50%, #065f46 100%)" }}
          />
          <div className="absolute inset-[3px] rounded-full bg-white/10 mix-blend-overlay" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.06] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <div className="relative overflow-hidden rounded-3xl px-7 py-8 sm:px-9 sm:py-10">
            <div className="relative text-center">
              <h1 className="font-display text-[26px] font-medium leading-tight text-white">{title}</h1>
              {subtitle && <p className="mt-2 text-sm leading-relaxed text-white/50">{subtitle}</p>}
            </div>

            <div className="relative mt-7">{children}</div>

            {footer && <p className="relative mt-7 text-center text-sm text-white/50">{footer}</p>}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
