import type { Metadata } from "next";
import { OPEN_ROLES } from "./roles";

const ACCENT = "#5ff2ff";

export const metadata: Metadata = {
  title: "Careers — Prophezy",
  description: "Open roles and internships at Prophezy — building the AI operating system for students.",
};

const PRINCIPLES = [
  { title: "Ship to real students", body: "Every feature is validated against a real student workflow before it's considered done — not just a design review." },
  { title: "Own the whole slice", body: "Engineers own their feature from schema to UI to the eval that proves it works, not just one layer of the stack." },
  { title: "Default to writing it down", body: "Decisions, not just code, are documented — async-first because the team is distributed." },
];

const PROCESS = [
  { step: "1. Apply", body: "Send your resume and a short note on why this role to the email below, with the role title in the subject line." },
  { step: "2. Async screen", body: "A short written exercise relevant to the role — no live coding-under-pressure round for the first step." },
  { step: "3. Team interview", body: "One or two calls with the team you'd work with directly, focused on how you think through real problems." },
  { step: "4. Offer", body: "We move fast once we're aligned — most candidates hear back within a week of the final interview." },
];

const BENEFITS = [
  "Fully remote, async-friendly working hours",
  "Flexible time off — take it when you need it",
  "Learning budget for courses, books, and conference tickets",
  "Latest AI tooling and API access provided",
  "Small team, direct impact — no layers between you and what ships",
];

const FAQ = [
  { q: "Do I need to relocate?", a: "No. Prophezy is remote-first; the team works across time zones with overlap windows for synchronous work." },
  { q: "Can I apply to more than one role?", a: "Yes — mention it in your application and we'll route it to both teams." },
  { q: "Are internships paid?", a: "Yes, all internship roles are paid. Compensation details are shared during the screening step." },
];

export default function CareersPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-20">
        <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Careers
        </div>
        <h1
          className="max-w-3xl text-[clamp(32px,5vw,56px)] font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Build the tools you wished you had as a student.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60">
          Prophezy is a small, remote team building AI tooling used by students end to end — from their first
          semester's notes to their first job offer. We hire people who want to own real problems, not just tickets.
        </p>
      </div>

      <section className="mb-20 grid gap-8 sm:grid-cols-3">
        {PRINCIPLES.map((p) => (
          <div key={p.title}>
            <h3 className="mb-2 text-base font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
              {p.title}
            </h3>
            <p className="text-sm leading-relaxed text-white/60">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="mb-20 max-w-3xl">
        <h2 className="mb-4 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Culture &amp; remote policy
        </h2>
        <p className="text-base leading-relaxed text-white/70">
          The team is fully remote and async by default — most decisions happen in writing so anyone can catch up
          without a meeting. We keep a small number of overlap hours for real-time collaboration, but there's no
          expectation of being online outside of that. Internships and campus-ambassador roles are remote as well;
          you work from wherever you're studying.
        </p>
      </section>

      <section className="mb-20">
        <h2 className="mb-8 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Hiring process
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {PROCESS.map((p) => (
            <div key={p.step} className="rounded-xl border border-white/[0.08] p-6">
              <div className="mb-2 text-xs" style={{ fontFamily: "var(--font-mono)", color: ACCENT }}>
                {p.step}
              </div>
              <p className="text-sm leading-relaxed text-white/60">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20 max-w-3xl">
        <h2 className="mb-4 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Internship program
        </h2>
        <p className="text-base leading-relaxed text-white/70">
          Internships run on a rolling basis rather than fixed cohorts — you join a real team from day one and work
          on shipped features, not a side project. All internships are paid, remote, and open to students currently
          enrolled full-time.
        </p>
      </section>

      <section className="mb-20">
        <h2 className="mb-8 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Benefits
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-white/70">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
              {b}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-20">
        <h2 className="mb-8 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Open positions
        </h2>
        <div className="space-y-4">
          {OPEN_ROLES.map((r) => (
            <div
              key={r.id}
              id={r.id}
              className="rounded-xl border border-white/[0.08] p-6 transition-colors hover:border-white/20"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {r.title}
                </h3>
                <span className="text-xs text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                  {r.team} · {r.type} · {r.location}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{r.description}</p>
              <ul className="mt-3 space-y-1">
                {r.requirements.map((req) => (
                  <li key={req} className="text-xs text-white/45">
                    · {req}
                  </li>
                ))}
              </ul>
              <a
                href={`mailto:prophezy65@gmail.com?subject=${encodeURIComponent(`Application: ${r.title}`)}`}
                className="mt-4 inline-flex items-center text-xs font-medium"
                style={{ color: ACCENT, fontFamily: "var(--font-mono)" }}
              >
                Apply for this role →
              </a>
            </div>
          ))}
        </div>
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

      <section className="rounded-2xl border border-white/[0.08] p-10 text-center">
        <h2 className="text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
          Don't see the right role?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
          We're a small team and always open to hearing from strong people, even without an open posting.
        </p>
        <a
          href="mailto:prophezy65@gmail.com?subject=General%20Application"
          className="mt-6 inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-medium text-[#050505]"
          style={{ backgroundColor: ACCENT }}
        >
          prophezy65@gmail.com
        </a>
      </section>
    </div>
  );
}
