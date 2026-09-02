/**
 * app/app/interview-lab/components/InterviewerAvatar.tsx
 *
 * An illustrated (cartoon) female interviewer who reads each question aloud
 * with lip-sync-style mouth animation, occasional blinking, and an on-screen
 * caption. Voice is browser-native (free, offline) via useSpeech. Auto-speaks
 * whenever the question text changes.
 */
"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useSpeech } from "../useSpeech";

export function InterviewerAvatar({ text, questionNumber }: { text: string; questionNumber: number }) {
  const { supported, speaking, muted, speak, toggleMute } = useSpeech();

  // Auto-speak whenever a new question appears (keyed by number + text).
  useEffect(() => {
    if (!supported || muted) return;
    const t = setTimeout(() => speak(text), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, questionNumber, supported]);

  return (
    <div className="glass-panel flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center sm:gap-6">
      {/* avatar */}
      <div className="relative shrink-0">
        <motion.div
          animate={speaking ? { scale: [1, 1.03, 1] } : { scale: 1 }}
          transition={speaking ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
        >
          <CartoonGirl speaking={speaking} />
        </motion.div>
        {/* speaking ring */}
        {speaking && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-signal"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.35 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </div>

      {/* caption + controls */}
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <div className="mb-1.5 flex items-center justify-center gap-2 sm:justify-start">
          <span
            className="text-[11px] uppercase tracking-[0.16em] text-signal"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Aria · your interviewer
          </span>
          {speaking && (
            <span className="flex items-center gap-0.5" aria-label="speaking">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="inline-block h-2 w-1 rounded-full bg-signal"
                  animate={{ scaleY: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={questionNumber}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm leading-relaxed text-ink/90"
          >
            {text}
          </motion.p>
        </AnimatePresence>

        {supported && (
          <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={() => speak(text)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-xs text-mist transition-colors hover:text-ink"
            >
              <RotateCcw size={12} /> Replay
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-xs text-mist transition-colors hover:text-ink"
            >
              {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {muted ? "Unmute" : "Mute"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Pure SVG cartoon girl. Mouth + eyes animate; everything else is static. */
function CartoonGirl({ speaking }: { speaking: boolean }) {
  return (
    <svg width="84" height="84" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="ia-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2a33" />
          <stop offset="1" stopColor="#0f171c" />
        </linearGradient>
        <linearGradient id="ia-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b3b2e" />
          <stop offset="1" stopColor="#3d2620" />
        </linearGradient>
      </defs>

      {/* backdrop disc */}
      <circle cx="50" cy="50" r="48" fill="url(#ia-bg)" stroke="rgba(95,242,255,0.25)" strokeWidth="1.5" />

      {/* hair back */}
      <path d="M22 54c0-20 12-34 28-34s28 14 28 34c0 8-2 14-4 18-2-14-6-22-6-22s-4 6-18 6-18-6-18-6-4 8-6 22c-2-4-4-10-4-18Z" fill="url(#ia-hair)" />

      {/* neck */}
      <rect x="44" y="60" width="12" height="12" rx="4" fill="#e8b58f" />

      {/* face */}
      <ellipse cx="50" cy="48" rx="18" ry="20" fill="#f2c6a0" />

      {/* hair front / bangs */}
      <path d="M32 44c1-14 9-22 18-22s17 8 18 22c-4-6-8-8-8-8s-3 4-10 4-10-4-10-4-4 2-8 8Z" fill="url(#ia-hair)" />

      {/* eyes (blink) */}
      <motion.g
        animate={{ scaleY: [1, 1, 0.1, 1] }}
        transition={{ duration: 0.28, repeat: Infinity, repeatDelay: 3.2, ease: "easeInOut" }}
        style={{ transformOrigin: "50px 46px" }}
      >
        <ellipse cx="43" cy="46" rx="2.6" ry="3.2" fill="#2b2b2b" />
        <ellipse cx="57" cy="46" rx="2.6" ry="3.2" fill="#2b2b2b" />
        <circle cx="42.2" cy="45" r="0.9" fill="#fff" />
        <circle cx="56.2" cy="45" r="0.9" fill="#fff" />
      </motion.g>

      {/* brows */}
      <path d="M39 41c2-1.5 5-1.5 7 0" stroke="#5b3b2e" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M54 41c2-1.5 5-1.5 7 0" stroke="#5b3b2e" strokeWidth="1.4" strokeLinecap="round" />

      {/* cheeks */}
      <circle cx="40" cy="53" r="2.4" fill="#f2a49a" opacity="0.55" />
      <circle cx="60" cy="53" r="2.4" fill="#f2a49a" opacity="0.55" />

      {/* mouth: animates open/close while speaking, gentle smile when idle */}
      {speaking ? (
        <motion.ellipse
          cx="50"
          cy="57"
          rx="4"
          fill="#8a3b3b"
          animate={{ ry: [1.2, 3.6, 1.6, 3.2, 1.2] }}
          transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : (
        <path d="M45 56c2 2.5 8 2.5 10 0" stroke="#8a3b3b" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}
