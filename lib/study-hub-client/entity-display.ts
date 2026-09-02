import { FileText, Layers, ClipboardList, HelpCircle, FolderKanban, FileBadge, GraduationCap, TrendingUp, Radar, type LucideIcon } from "lucide-react";
import type { StudyEntityType } from "@/lib/study-hub/types";

interface EntityDisplay {
  label: string;
  icon: LucideIcon;
  href: (id: string) => string;
}

/**
 * Only note/research_paper/trending_research_topic link to their listing
 * page rather than a real detail route — lib/notes and the research
 * module currently fail to type-check against the live schema (pre-
 * existing, unrelated to Study Hub), so linking to a specific unverified
 * detail route risks a broken link. flashcard_deck/quiz/internship link
 * directly since those modules are confirmed healthy.
 */
export const ENTITY_DISPLAY: Record<StudyEntityType, EntityDisplay> = {
  note: { label: "Note", icon: FileText, href: () => "/app/notes" },
  flashcard_deck: { label: "Flashcard Deck", icon: Layers, href: (id) => `/app/flashcards/${id}` },
  assignment: { label: "Assignment", icon: ClipboardList, href: () => "/app/assignments" },
  quiz: { label: "Quiz", icon: HelpCircle, href: (id) => `/app/quiz/${id}` },
  project: { label: "Project", icon: FolderKanban, href: () => "/app/projects" },
  resume: { label: "Resume", icon: FileBadge, href: () => "/app/resume-studio" },
  research_paper: { label: "Research Paper", icon: GraduationCap, href: () => "/app/research-papers" },
  trending_research_topic: { label: "Trending Topic", icon: TrendingUp, href: () => "/app/research-papers" },
  internship: { label: "Internship", icon: Radar, href: (id) => `/app/opportunities/${id}` },
};
