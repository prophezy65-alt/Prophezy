"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BrainCircuit,
  FileText,
  Mic,
  Layers,
  FileBadge,
  Briefcase,
  Video,
  FolderKanban,
  FlaskConical,
  Rocket,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/study", label: "Study Hub", icon: BrainCircuit },
  { href: "/dashboard/assignments", label: "Assignments", icon: FileText },
  { href: "/dashboard/viva", label: "Viva Coach", icon: Mic },
  { href: "/dashboard/flashcards", label: "Flashcards", icon: Layers },
  { href: "/dashboard/resume", label: "Resume Hub", icon: FileBadge },
  { href: "/dashboard/placement", label: "Placement", icon: Briefcase },
  { href: "/dashboard/interview", label: "Mock Interview", icon: Video },
  { href: "/dashboard/projects", label: "Project Hub", icon: FolderKanban },
  { href: "/dashboard/research", label: "Research Hub", icon: FlaskConical },
  { href: "/dashboard/internships", label: "Internships", icon: Rocket },
] as const;

export function Dock() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "glass fixed z-40 flex gap-1 rounded-2xl p-2 shadow-glass",
        // Bottom dock on mobile, left rail on desktop
        "inset-x-3 bottom-3 flex-row overflow-x-auto",
        "md:inset-x-auto md:inset-y-1/2 md:left-4 md:bottom-auto md:-translate-y-1/2 md:flex-col md:overflow-visible",
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
            className={cn(
              "group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
              active ? "bg-signal text-white" : "text-mist hover:bg-ink/5 hover:text-ink",
            )}
          >
            <Icon size={18} />
            <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-surface-raised px-2.5 py-1 text-xs text-ink opacity-0 shadow-glass-sm transition-opacity group-hover:opacity-100 md:block">
              {label}
            </span>
          </Link>
        );
      })}
      <Link
        href="/dashboard/settings"
        aria-label="Settings"
        title="Settings"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-mist transition-colors hover:bg-ink/5 hover:text-ink md:mt-1"
      >
        <Settings size={18} />
      </Link>
    </nav>
  );
}
