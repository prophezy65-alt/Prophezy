import type { LucideIcon } from "lucide-react";
import {
  Home,
  Radar,
  BookOpen,
  ClipboardList,
  NotebookPen,
  Layers,
  Brain,
  FileText,
  Mic,
  FolderKanban,
  GraduationCap,
  Trophy,
  Settings,
  Compass,
  Target,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Opportunity Scanner", href: "/app/opportunities", icon: Radar },
  { label: "Study Hub", href: "/app/study-hub", icon: BookOpen },
  { label: "Assignments", href: "/app/assignments", icon: ClipboardList },
  { label: "Notes", href: "/app/notes", icon: NotebookPen },
  { label: "Flashcards", href: "/app/flashcards", icon: Layers },
  { label: "Quiz", href: "/app/quiz", icon: Brain },
  { label: "Exam Predictor", href: "/app/exam-predictor", icon: Target },
  { label: "Resume Studio", href: "/app/resume-studio", icon: FileText },
  { label: "Interview Lab", href: "/app/interview-lab", icon: Mic },
  { label: "Career Guidance", href: "/app/career", icon: Compass },
  { label: "Projects", href: "/app/projects", icon: FolderKanban },
  { label: "Research Papers", href: "/app/research-papers", icon: GraduationCap },
  { label: "Hackathons", href: "/app/hackathons", icon: Trophy },
  { label: "Settings", href: "/app/settings", icon: Settings },
];

// Primary items shown in the mobile bottom bar — rest live under "More".
export const MOBILE_PRIMARY_HREFS = ["/app", "/app/opportunities", "/app/study-hub", "/app/notes"];
