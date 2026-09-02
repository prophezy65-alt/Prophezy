"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Command,
  TrendingUp,
  FileText,
  Mic,
  Layers,
  FlaskConical,
  ClipboardList,
  FolderKanban,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { ProjectStats, ActivityItem, ActivityKind, NextAction } from "@/lib/dashboard/live-context";

const ACCENT = "#5ff2ff";

export interface AppHomeClientProps {
  firstName: string | null;
  streak: number;
  resumeStats: { score: number | null; title: string | null };
  interviewStats: { averageScore: number | null; totalAttempts: number };
  cardsDue: number;
  researchCount: number;
  assignmentsCount: number;
  projectStats: ProjectStats;
  weeklyActivity: { label: string; count: number }[];
  recentActivity: ActivityItem[];
  nextAction: NextAction | null;
}

const ACTIVITY_ICON: Record<ActivityKind, React.ReactNode> = {
  generation: <Sparkles size={13} />,
  interview: <Mic size={13} />,
  project: <FolderKanban size={13} />,
  research: <FlaskConical size={13} />,
  resume: <FileText size={13} />,
};

function useGreeting(): string {
  // Computed client-side so it reflects the visitor's actual local time,
  // not the server's timezone.
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return greeting;
}

function StatTile({
  icon,
  label,
  value,
  sublabel,
  delay,
  emptyCta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  sublabel: string;
  delay: number;
  emptyCta?: { text: string; href: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5"
    >
      <div
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <span style={{ color: ACCENT }}>{icon}</span>
        {label}
      </div>
      {value !== null ? (
        <>
          <div className="mt-2 text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
            {value}
          </div>
          <div className="mt-1 text-xs text-white/40">{sublabel}</div>
        </>
      ) : emptyCta ? (
        <Link
          href={emptyCta.href}
          className="mt-2.5 flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
        >
          {emptyCta.text}
          <ArrowRight size={13} style={{ color: ACCENT }} />
        </Link>
      ) : (
        <div className="mt-2 text-sm text-white/40">{sublabel}</div>
      )}
    </motion.div>
  );
}

export default function AppHomeClient(props: AppHomeClientProps) {
  const {
    firstName,
    streak,
    resumeStats,
    interviewStats,
    cardsDue,
    researchCount,
    assignmentsCount,
    projectStats,
    weeklyActivity,
    recentActivity,
    nextAction,
  } = props;

  const greeting = useGreeting();
  const maxWeeklyCount = Math.max(1, ...weeklyActivity.map((d) => d.count));

  return (
    <div className="mx-auto max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div
          className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
          System online
        </div>
        <h1 className="text-3xl font-medium text-white sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/50">
          {nextAction ? (
            <>
              {nextAction.message}{" "}
              <Link
                href={nextAction.href}
                className="underline decoration-white/20 underline-offset-2 hover:text-white"
                style={{ color: ACCENT }}
              >
                Go now
              </Link>
              .
            </>
          ) : (
            <>You&apos;re all caught up — nothing waiting on you right now.</>
          )}
        </p>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/35">
          Use the sidebar, or press <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[11px]">⌘K</kbd> to jump anywhere.
        </p>
      </motion.div>

      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
        className="mt-8 flex w-full max-w-sm items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5 text-left text-sm text-white/50 transition-colors hover:border-white/20"
      >
        <Command size={16} style={{ color: ACCENT }} />
        Open command palette
        <kbd className="ml-auto rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/40">⌘K</kbd>
      </motion.button>

      {/* Live stats */}
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          icon={<TrendingUp size={13} />}
          label="Streak"
          value={streak > 0 ? (streak === 1 ? "1 day" : `${streak} days`) : null}
          sublabel="Keep it going today"
          delay={0.22}
          emptyCta={{ text: "Start a session", href: "/app/study-hub" }}
        />
        <StatTile
          icon={<FileText size={13} />}
          label="Resume"
          value={resumeStats.score !== null ? `${resumeStats.score}/100` : null}
          sublabel={resumeStats.title ? `ATS score · ${resumeStats.title}` : ""}
          delay={0.28}
          emptyCta={{ text: "Upload resume", href: "/app/resume-studio" }}
        />
        <StatTile
          icon={<Mic size={13} />}
          label="Viva"
          value={interviewStats.averageScore !== null ? `${interviewStats.averageScore}/10` : null}
          sublabel={`${interviewStats.totalAttempts} session${interviewStats.totalAttempts === 1 ? "" : "s"}`}
          delay={0.34}
          emptyCta={{ text: "Start your first interview", href: "/app/interview-lab" }}
        />
        <StatTile
          icon={<Layers size={13} />}
          label="Cards due"
          value={String(cardsDue)}
          sublabel={cardsDue > 0 ? "Ready to review" : "Nothing due — you're caught up"}
          delay={0.4}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon={<FlaskConical size={13} />}
          label="Research"
          value={researchCount > 0 ? String(researchCount) : null}
          sublabel="papers saved"
          delay={0.46}
          emptyCta={{ text: "Upload a paper", href: "/app/research-papers" }}
        />
        <StatTile
          icon={<ClipboardList size={13} />}
          label="Assignments"
          value={assignmentsCount > 0 ? String(assignmentsCount) : null}
          sublabel="generated"
          delay={0.52}
          emptyCta={{ text: "Generate an assignment", href: "/app/assignments" }}
        />
        <StatTile
          icon={<FolderKanban size={13} />}
          label="Projects"
          value={projectStats.total > 0 ? String(projectStats.total) : null}
          sublabel={`${projectStats.byStatus.in_progress} in progress · ${projectStats.byStatus.completed} done`}
          delay={0.58}
          emptyCta={{ text: "Generate your first project", href: "/app/projects" }}
        />
      </div>

      {/* Weekly activity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.64 }}
        className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4"
      >
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
          This week
        </div>
        <div className="mt-3 flex items-end gap-3" style={{ height: 72 }}>
          {weeklyActivity.map((day) => (
            <div key={day.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(3, (day.count / maxWeeklyCount) * 52)}px`,
                  backgroundColor: ACCENT,
                  opacity: day.count > 0 ? 0.75 : 0.15,
                }}
                title={`${day.count} on ${day.label}`}
              />
              <span className="text-[10px] text-white/35">{day.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AI Activity / Recent activity — real events only */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4"
      >
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
          AI activity
        </div>
        {recentActivity.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2.5">
            {recentActivity.map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-white/70">
                <span className="shrink-0" style={{ color: ACCENT }}>
                  {ACTIVITY_ICON[item.kind]}
                </span>
                <span className="flex-1">{item.title}</span>
                <span className="shrink-0 text-xs text-white/35">
                  {new Date(item.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/40">
            Nothing yet — generate notes, run a mock interview, or start a project to see activity here.
          </p>
        )}
      </motion.div>
    </div>
  );
}
