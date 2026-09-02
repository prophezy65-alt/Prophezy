export interface Role {
  id: string;
  title: string;
  team: string;
  type: "Full-time" | "Internship";
  location: "Remote" | "Remote (India)" | "Remote-first";
  description: string;
  requirements: string[];
}

// Static role listing. Editing this array is how you open/close roles —
// intentionally not a database table, since roles change rarely and this
// avoids standing up write access + moderation for a handful of postings.
// If hiring volume grows, this can move to a `careers_roles` Supabase table
// with the same shape without changing the page component.
export const OPEN_ROLES: Role[] = [
  {
    id: "ai-engineer",
    title: "AI Engineer",
    team: "AI Platform",
    type: "Full-time",
    location: "Remote",
    description:
      "Own the prompting, grounding, and evaluation pipeline behind Study Hub, Research Lab, and Resume Studio's Gemini-backed features. You'll work on document parsing quality, hallucination reduction, and latency.",
    requirements: [
      "Production experience with LLM APIs (Gemini, OpenAI, or Claude) beyond a demo project",
      "Comfortable writing and maintaining eval suites for prompt changes",
      "Strong TypeScript/Node fundamentals",
    ],
  },
  {
    id: "fullstack-developer",
    title: "Full Stack Developer",
    team: "Product Engineering",
    type: "Full-time",
    location: "Remote",
    description:
      "Build across the Next.js app and Supabase backend — new modules, API routes, and the schema work that supports them. You'll ship features end to end, not just one layer.",
    requirements: [
      "2+ years with React/Next.js and a relational database in production",
      "Comfortable owning a feature from schema design to shipped UI",
      "Experience with Postgres row-level security is a plus",
    ],
  },
  {
    id: "frontend-developer",
    title: "Frontend Developer",
    team: "Product Engineering",
    type: "Full-time",
    location: "Remote",
    description:
      "Focus on the interaction and motion layer — dashboard views, data-heavy tables, and the animated marketing sections. Strong eye for detail and performance.",
    requirements: [
      "Deep React + TypeScript experience",
      "Comfortable with Framer Motion or similar animation libraries",
      "A portfolio or GitHub showing UI work, not just backend projects",
    ],
  },
  {
    id: "backend-developer",
    title: "Backend Developer",
    team: "Platform",
    type: "Full-time",
    location: "Remote",
    description:
      "Work on the internship-sync pipeline, notification jobs, and the Postgres schema behind every module. Correctness and idempotency matter more than novelty here.",
    requirements: [
      "Strong SQL and schema design skills",
      "Experience building and debugging scheduled/background jobs",
      "Node.js/TypeScript in production",
    ],
  },
  {
    id: "ui-ux-designer",
    title: "UI/UX Designer",
    team: "Design",
    type: "Full-time",
    location: "Remote",
    description:
      "Design new modules and refine existing ones without breaking the system's visual language. You'll work closely with engineering to ship, not just hand off mockups.",
    requirements: [
      "A portfolio with shipped product work, not just concept pieces",
      "Comfortable in Figma and reading/writing basic Tailwind for handoff",
      "Experience designing data-dense dashboards is a plus",
    ],
  },
  {
    id: "ai-research-intern",
    title: "AI Research Intern",
    team: "AI Platform",
    type: "Internship",
    location: "Remote (India)",
    description:
      "Help evaluate and improve the accuracy of AI-generated study material — quiz quality, summarization faithfulness, and citation extraction accuracy.",
    requirements: [
      "Currently enrolled in a CS, AI/ML, or related program",
      "Comfortable reading research papers and writing evaluation scripts",
      "Python or TypeScript proficiency",
    ],
  },
  {
    id: "marketing-intern",
    title: "Marketing Intern",
    team: "Growth",
    type: "Internship",
    location: "Remote (India)",
    description:
      "Own content for the blog and social channels aimed at students — internship guides, resume advice, and roadmap content grounded in what actually works.",
    requirements: [
      "Strong written English and a genuine interest in the student/career space",
      "Comfortable researching and writing long-form content independently",
      "Basic familiarity with SEO fundamentals is a plus",
    ],
  },
  {
    id: "campus-ambassador",
    title: "Campus Ambassador",
    team: "Growth",
    type: "Internship",
    location: "Remote (India)",
    description:
      "Represent Prophezy on your campus — run awareness sessions, gather student feedback, and help coordinate campus-specific launches.",
    requirements: [
      "Currently enrolled full-time at a college or university",
      "Active in at least one student community, club, or society",
      "Comfortable speaking to groups and running small events",
    ],
  },
];
