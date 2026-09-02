export const DIGEST_ITEMS = [
  { id: "internships", icon: "🎯", label: "AI found", value: "18 internships", color: "#ff7a45" },
  { id: "hackathons", icon: "⚡", label: "Discovered", value: "2 hackathons", color: "#5ff2ff" },
  { id: "scholarships", icon: "🎓", label: "Matched", value: "4 scholarships", color: "#4d8dff" },
  { id: "papers", icon: "🧠", label: "Summarized", value: "3 research papers", color: "#9d6bff" },
  { id: "assignments", icon: "📄", label: "Due tomorrow", value: "2 assignments", color: "#ff7a45" },
  { id: "resume", icon: "📈", label: "Resume score improved to", value: "89%", color: "#3fe8c4" },
  { id: "interview", icon: "🎙", label: "Reminder", value: "1 interview tomorrow, 10:00 AM", color: "#5ff2ff" },
];

export const QUICK_MODULES = [
  { id: "opportunities", title: "Opportunity Scanner", stat: "18 new", href: "/app/opportunities", color: "#ff7a45" },
  { id: "study-hub", title: "Study Hub", stat: "4 subjects active", href: "/app/study-hub", color: "#5ff2ff" },
  { id: "resume-studio", title: "Resume Studio", stat: "ATS score 89%", href: "/app/resume-studio", color: "#9d6bff" },
  { id: "interview-lab", title: "Interview Lab", stat: "1 session tomorrow", href: "/app/interview-lab", color: "#4d8dff" },
  { id: "projects", title: "Projects", stat: "3 in progress", href: "/app/projects", color: "#3fe8c4" },
  { id: "research-papers", title: "Research Papers", stat: "3 summarized today", href: "/app/research-papers", color: "#ff7a45" },
];

export const RIGHT_PANEL_ACTIONS = [
  { id: "a1", text: "Summarized \u201cAttention Is All You Need\u201d", time: "12m ago" },
  { id: "a2", text: "Found a Razorpay backend internship match", time: "38m ago" },
  { id: "a3", text: "Improved resume keyword score by 6%", time: "1h ago" },
  { id: "a4", text: "Generated 24 flashcards from DBMS notes", time: "2h ago" },
];

export const RIGHT_PANEL_SUGGESTIONS = [
  "Your resume is missing \u201cSystem Design\u201d — add it before applying to Atlassian.",
  "3 subjects have no notes this week. Want a quick capture session?",
  "Interview Lab: your Behavioral score dropped 8% last attempt.",
];

export const RIGHT_PANEL_DEADLINES = [
  { id: "d1", label: "DBMS Assignment 4", due: "Tomorrow, 11:59 PM" },
  { id: "d2", label: "Razorpay internship deadline", due: "Aug 5" },
  { id: "d3", label: "Mock interview — Technical", due: "Tomorrow, 10:00 AM" },
];

export const SUBJECTS = [
  { id: "dbms", name: "Database Systems", progress: 74, notes: 18, assignments: 3, color: "#5ff2ff" },
  { id: "os", name: "Operating Systems", progress: 58, notes: 12, assignments: 1, color: "#4d8dff" },
  { id: "ml", name: "Machine Learning", progress: 86, notes: 24, assignments: 2, color: "#9d6bff" },
  { id: "algo", name: "Algorithms", progress: 41, notes: 9, assignments: 4, color: "#ff7a45" },
];

export const RESUME_VERSIONS = [
  { id: "v3", label: "v3 — SWE focused", score: 89, date: "2 days ago" },
  { id: "v2", label: "v2 — Data roles", score: 81, date: "1 week ago" },
  { id: "v1", label: "v1 — General", score: 68, date: "3 weeks ago" },
];

export const RESUME_SUGGESTIONS = [
  "Add \u201cSystem Design\u201d — appears in 6 of your target roles.",
  "Quantify the Razorpay project bullet with a measurable outcome.",
  "Move Projects above Education for technical roles.",
];

export const KEYWORDS = [
  { term: "React", found: true }, { term: "TypeScript", found: true },
  { term: "System Design", found: false }, { term: "PostgreSQL", found: true },
  { term: "Docker", found: false }, { term: "REST APIs", found: true },
];

export const INTERVIEW_CATEGORIES = [
  { id: "hr", label: "HR", progress: 72, color: "#5ff2ff" },
  { id: "technical", label: "Technical", progress: 64, color: "#4d8dff" },
  { id: "behavioral", label: "Behavioral", progress: 55, color: "#9d6bff" },
  { id: "coding", label: "Coding", progress: 80, color: "#3fe8c4" },
  { id: "voice", label: "Voice AI", progress: 30, color: "#ff7a45" },
  { id: "company", label: "Company Questions", progress: 45, color: "#5ff2ff" },
];

export const PROJECTS = [
  {
    id: "p1", name: "Prophezy Landing", stack: ["Next.js", "R3F", "Framer Motion"],
    aiReview: 91, stars: 24, status: "In progress", color: "#5ff2ff",
  },
  {
    id: "p2", name: "Expense Tracker", stack: ["Next.js", "Postgres", "Prisma"],
    aiReview: 78, stars: 6, status: "In progress", color: "#4d8dff",
  },
  {
    id: "p3", name: "ML Resume Parser", stack: ["Python", "spaCy", "FastAPI"],
    aiReview: 85, stars: 12, status: "Idea", color: "#9d6bff",
  },
];

export const RESEARCH_PAPERS = [
  { id: "r1", title: "Attention Is All You Need", venue: "NeurIPS", citations: "112k", tag: "Foundational", color: "#5ff2ff" },
  { id: "r2", title: "A Survey of RAG Techniques", venue: "arXiv 2026", citations: "340", tag: "Trending", color: "#ff7a45" },
  { id: "r3", title: "Scaling Laws for Small Models", venue: "arXiv 2026", citations: "890", tag: "Trending", color: "#ff7a45" },
  { id: "r4", title: "Efficient Attention for Edge Devices", venue: "MLSys", citations: "210", tag: "Related", color: "#9d6bff" },
];
