import type { Metadata } from "next";

const ACCENT = "#5ff2ff";

export const metadata: Metadata = {
  title: "About — Prophezy",
  description:
    "Prophezy is the AI operating system for students — one place to study, research, build a resume, and find real opportunities.",
};

const FEATURES = [
  {
    name: "AI Study Hub",
    body: "Turns lecture slides, PDFs, and notes into structured study material — summaries, flashcards, and quizzes generated from what you actually uploaded, not generic content.",
  },
  {
    name: "Research Lab",
    body: "OCR and summarize academic papers, extract citations, and chat with your own library of sources with answers grounded in the actual text.",
  },
  {
    name: "Resume Studio",
    body: "Build and score resumes against real ATS parsing logic, with version history and role-targeted rewrites.",
  },
  {
    name: "Placement Engine",
    body: "A background AI process that continuously scans internship and job sources, filters out what doesn't fit your profile, and explains why the rest made the cut. You always apply on the original source.",
  },
];

const TIMELINE = [
  { year: "2024", label: "Origin", body: "Started as a single internal tool to help a small group of students track internship deadlines without spreadsheets." },
  { year: "2025", label: "Study Hub + Research Lab", body: "Rebuilt around document understanding — quiz generation from uploaded material, and OCR-backed research summarization." },
  { year: "2025", label: "Resume Studio", body: "Added ATS-aware resume scoring and version comparison after seeing how often strong candidates were filtered out by parsing, not skill." },
  { year: "2026", label: "Placement Engine", body: "Launched the always-on opportunity discovery system, connecting multiple job sources into one filtered, ranked feed." },
];

const STACK = [
  { name: "Next.js 15 / React 19", role: "Application framework and UI" },
  { name: "Supabase (Postgres)", role: "Database, auth, storage, and row-level security" },
  { name: "Google Gemini", role: "Document understanding, summarization, and quiz/flashcard generation" },
  { name: "pdf-lib / pdfjs-dist / pdf-parse", role: "PDF parsing, OCR pipeline, and document export" },
  { name: "Tesseract.js", role: "Optical character recognition for scanned documents" },
  { name: "Framer Motion", role: "Interface motion and transitions" },
];

const FAQ = [
  {
    q: "Is Prophezy free to use?",
    a: "Core study tools are free to start. Paid tiers unlock higher usage limits on AI-heavy features like quiz generation, research summarization, and resume exports — see the Pricing section on the homepage for current tiers.",
  },
  {
    q: "Does Prophezy apply to jobs or internships for me?",
    a: "No. The Placement Engine discovers and ranks opportunities across sources, but every application is completed by you, on the original platform — Internshala, LinkedIn, GitHub, or the company's own careers page.",
  },
  {
    q: "What happens to documents I upload?",
    a: "Uploaded documents are stored against your account in Supabase storage and used only to generate the study material, summaries, or resume content you requested. See our Privacy Policy and Data Retention Policy for details and deletion options.",
  },
  {
    q: "Which AI model powers the study tools?",
    a: "Document summarization, quiz generation, and research chat are powered by Google Gemini. See our AI Usage Policy for how model output is generated, reviewed, and limited.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-20">
        <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          About Prophezy
        </div>
        <h1
          className="max-w-3xl text-[clamp(32px,5vw,56px)] font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          One operating system for the entire student workload.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60">
          Prophezy replaces the six or seven disconnected tabs a student normally keeps open — a summarizer, a flashcard
          app, a resume checker, a research assistant, and a handful of internship boards — with one system that
          understands what you're studying and what you're aiming for.
        </p>
      </div>

      <section className="mb-20 grid gap-10 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            Mission
          </h2>
          <p className="text-lg leading-relaxed text-white/80">
            Give every student access to the same quality of study tooling, resume feedback, and opportunity discovery
            that well-connected students get for free from mentors, career centers, and paid consultants.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            Vision
          </h2>
          <p className="text-lg leading-relaxed text-white/80">
            A single AI layer that sits underneath a student's entire academic and early-career journey — from the
            first semester's notes to the first job offer — instead of a dozen single-purpose apps that don't talk to
            each other.
          </p>
        </div>
      </section>

      <section className="mb-20">
        <h2 className="mb-8 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Core features
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.name} className="rounded-xl border border-white/[0.08] p-6">
              <h3 className="mb-2 text-base font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
                {f.name}
              </h3>
              <p className="text-sm leading-relaxed text-white/60">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20 max-w-3xl">
        <h2 className="mb-4 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Why we built it
        </h2>
        <p className="text-base leading-relaxed text-white/70">
          Most study and career tools solve one narrow problem well and then hand you off. A summarizer doesn't know
          what's on your resume. A resume checker doesn't know what internships you're actually qualified for. An
          internship board doesn't know what you've been studying. Prophezy was built because that hand-off is where
          most students lose momentum — so the system keeps the context instead of making you re-explain yourself to
          every new tool.
        </p>
      </section>

      <section className="mb-20">
        <h2 className="mb-8 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Timeline
        </h2>
        <div className="space-y-6 border-l border-white/[0.08] pl-6">
          {TIMELINE.map((t) => (
            <div key={t.year + t.label}>
              <div className="text-xs" style={{ fontFamily: "var(--font-mono)", color: ACCENT }}>
                {t.year}
              </div>
              <h3 className="mt-1 text-base font-medium text-white">{t.label}</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/60">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20">
        <h2 className="mb-8 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Tech stack
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {STACK.map((s) => (
            <div key={s.name} className="flex items-baseline justify-between border-b border-white/[0.06] py-3 text-sm">
              <span className="text-white/85">{s.name}</span>
              <span className="text-right text-white/40">{s.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20 max-w-3xl">
        <h2 className="mb-4 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          AI architecture overview
        </h2>
        <p className="text-base leading-relaxed text-white/70">
          Every AI feature follows the same shape: your document or query is parsed server-side (OCR via Tesseract.js
          for scanned files, native parsing for text-based PDFs and DOCX), sent to Gemini with a task-specific prompt
          and the extracted content as grounding context, and the response is validated and stored against your
          account in Supabase before being shown to you. Nothing is generated from the model's general knowledge
          alone when a source document is involved — the model is grounded in what you uploaded.
        </p>
      </section>

      <section className="mb-20">
        <h2 className="mb-8 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          FAQ
        </h2>
        <div className="space-y-6">
          {FAQ.map((f) => (
            <div key={f.q} className="border-b border-white/[0.06] pb-6">
              <h3 className="mb-2 text-base font-medium text-white">{f.q}</h3>
              <p className="text-sm leading-relaxed text-white/60">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
