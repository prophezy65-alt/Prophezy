"use client";

import { cn } from "@/lib/utils";

interface ProphecyRingProps {
  /** 0–100 */
  value: number;
  label?: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  tone?: "signal" | "pulse" | "success";
  className?: string;
}

const TONE_COLOR: Record<NonNullable<ProphecyRingProps["tone"]>, string> = {
  signal: "hsl(var(--signal))",
  pulse: "hsl(var(--pulse))",
  success: "hsl(var(--success))",
};

/**
 * The Prophecy Ring is Prophezy's one recurring signature element: every
 * predicted or scored quantity in the product — ATS score, viva confidence,
 * research novelty, CGPA, resume strength — renders through this same shape,
 * so a student learns to read "the ring" once and reuses that instinct
 * everywhere.
 */
export function ProphecyRing({
  value,
  label,
  sublabel,
  size = 128,
  strokeWidth = 10,
  tone = "signal",
  className,
}: ProphecyRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          className="animate-ring-draw"
          style={
            {
              "--ring-circumference": circumference,
              "--ring-offset": offset,
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="font-mono text-2xl font-semibold text-ink">{Math.round(clamped)}</span>
        {label && <span className="text-[11px] font-medium uppercase tracking-wide text-mist">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[10px] text-mist/80">{sublabel}</span>}
      </div>
    </div>
  );
}
