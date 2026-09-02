export interface NavItem {
  id: string;
  label: string;
  href: string;
  group: "core" | "academics" | "career" | "library";
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", href: "/app", group: "core" },
  { id: "command", label: "AI Command Center", href: "/app/command-center", group: "core" },
  { id: "opportunities", label: "Opportunity Scanner", href: "/app/opportunities", group: "career" },
  { id: "study-hub", label: "Study Hub", href: "/app/study-hub", group: "academics" },
  { id: "assignments", label: "Assignments", href: "/app/assignments", group: "academics" },
  { id: "notes", label: "Notes", href: "/app/notes", group: "academics" },
  { id: "flashcards", label: "Flashcards", href: "/app/flashcards", group: "academics" },
  { id: "resume-studio", label: "Resume Studio", href: "/app/resume-studio", group: "career" },
  { id: "interview-lab", label: "Interview Lab", href: "/app/interview-lab", group: "career" },
  { id: "career-guidance", label: "Career Guidance", href: "/app/career", group: "career" },
  { id: "projects", label: "Projects", href: "/app/projects", group: "career" },
  { id: "research-papers", label: "Research Papers", href: "/app/research-papers", group: "library" },
  { id: "hackathons", label: "Hackathons", href: "/app/hackathons", group: "career" },
  { id: "bookmarks", label: "Bookmarks", href: "/app/bookmarks", group: "library" },
  { id: "settings", label: "Settings", href: "/app/settings", group: "core" },
  { id: "profile", label: "Profile", href: "/app/profile", group: "core" },
];

export const NAV_GROUPS: { id: NavItem["group"]; label: string }[] = [
  { id: "core", label: "" },
  { id: "academics", label: "Academics" },
  { id: "career", label: "Career" },
  { id: "library", label: "Library" },
];
