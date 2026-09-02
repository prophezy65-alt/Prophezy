export interface Command {
  id: string;
  label: string;
  hint: string;
  href: string;
}

export const COMMANDS: Command[] = [
  { id: "find-internship", label: "Find Internship", hint: "Scan live opportunities", href: "/app/opportunities" },
  { id: "summarize-pdf", label: "Summarize PDF", hint: "Study Hub · AI Summary", href: "/app/study-hub" },
  { id: "generate-flashcards", label: "Generate Flashcards", hint: "From your notes", href: "/app/flashcards" },
  { id: "create-notes", label: "Create Notes", hint: "New note in Study Hub", href: "/app/notes" },
  { id: "mock-interview", label: "Mock Interview", hint: "Interview Lab", href: "/app/interview-lab" },
  { id: "improve-resume", label: "Improve Resume", hint: "Resume Studio · AI Suggestions", href: "/app/resume-studio" },
  { id: "find-hackathons", label: "Find Hackathons", hint: "Scan live events", href: "/app/hackathons" },
  { id: "generate-quiz", label: "Generate Quiz", hint: "From your subjects", href: "/app/study-hub" },
  { id: "search-everything", label: "Search Everything", hint: "Notes, papers, opportunities", href: "/app" },
];
