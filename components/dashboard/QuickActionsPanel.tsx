"use client";

import Link from "next/link";
import { Plus, FileText, Mic, Layers, HelpCircle, FolderKanban, Radar, Sparkles, type LucideIcon } from "lucide-react";

const ACCENT = "#5ff2ff";

export interface QuickAction {
  key: string;
  label: string;
  href?: string;
  icon: "note" | "resume" | "interview" | "flashcards" | "quiz" | "project" | "scan" | "ask";
}

const ICONS: Record<QuickAction["icon"], LucideIcon> = {
  note: Plus,
  resume: FileText,
  interview: Mic,
  flashcards: Layers,
  quiz: HelpCircle,
  project: FolderKanban,
  scan: Radar,
  ask: Sparkles,
};

export default function QuickActionsPanel({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((a) => {
        const Icon = ICONS[a.icon];
        const content = (
          <>
            <Icon size={14} style={{ color: ACCENT }} />
            {a.label}
          </>
        );
        const className =
          "flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] py-3 text-[10px] text-white/60 transition-colors hover:border-white/20 hover:text-white";

        if (a.href) {
          return (
            <Link key={a.key} href={a.href} className={className}>
              {content}
            </Link>
          );
        }

        return (
          <button
            key={a.key}
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("prophezy-assistant:open"))}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
