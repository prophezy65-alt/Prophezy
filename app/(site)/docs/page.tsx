import type { Metadata } from "next";

const ACCENT = "#5ff2ff";

export const metadata: Metadata = {
  title: "Docs — Prophezy",
  description: "Documentation for Prophezy — getting started, modules, the AI engine, API, and troubleshooting.",
};

const NAV = [
  { id: "getting-started", label: "Getting Started" },
  { id: "features", label: "Features" },
  { id: "modules", label: "Modules" },
  { id: "ai-engine", label: "AI Engine" },
  { id: "api", label: "API" },
  { id: "shortcuts", label: "Keyboard Shortcuts" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "faq", label: "FAQ" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-white/[0.06] py-12">
      <h2 className="mb-4 text-xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      <div className="max-w-2xl space-y-4 text-sm leading-relaxed text-white/65">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-14">
        <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Documentation
        </div>
        <h1
          className="max-w-2xl text-[clamp(30px,4.5vw,48px)] font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Everything you need to run Prophezy end to end.
        </h1>
      </div>

      <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="block rounded-lg px-3 py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </div>
        </nav>

        <div>
          <Section id="getting-started" title="Getting Started">
            <p>
              Create an account and you land directly in the app shell — Study Hub, Research Lab, Resume Studio, and
              Placement Engine are all available from the sidebar immediately, no separate setup per module.
            </p>
            <p>
              For the fastest first result, upload one document into Study Hub (a PDF or slide deck works best) and
              generate a quiz from it. That single flow touches upload, parsing, and AI generation, and is the
              quickest way to confirm everything's working end to end.
            </p>
          </Section>

          <Section id="features" title="Features">
            <ul className="list-disc space-y-2 pl-5">
              <li>Document-grounded quiz and flashcard generation (Study Hub)</li>
              <li>Paper OCR, summarization, and citation extraction (Research Lab)</li>
              <li>ATS-aware resume building, scoring, and version history (Resume Studio)</li>
              <li>Continuous, filtered opportunity discovery across multiple sources (Placement Engine)</li>
              <li>Project generation, interview practice, and note-taking tools inside the same account</li>
            </ul>
          </Section>

          <Section id="modules" title="Modules">
            <p>
              Each module is independent but shares your account context — a resume built in Resume Studio can
              reflect skills surfaced from projects you've logged, and Placement Engine ranks opportunities against
              the same profile. You don't need to re-enter your background for each tool.
            </p>
          </Section>

          <Section id="ai-engine" title="AI Engine">
            <p>
              AI-generated content across Prophezy is powered by Google Gemini. When a feature involves a document
              you uploaded — a quiz, a summary, a resume rewrite — the model is grounded in the extracted text of that
              document, not generated purely from general knowledge. See the{" "}
              <a href="/legal/ai-usage" className="underline" style={{ color: ACCENT }}>
                AI Usage Policy
              </a>{" "}
              for the full detail on how output is generated and what limitations apply.
            </p>
          </Section>

          <Section id="api" title="API Documentation">
            <p>
              Prophezy's internal API routes (under <code className="text-white/80">/api/*</code>) power the web app
              itself and are authenticated per-session — there is currently no public, standalone API for third-party
              integrations. If you need programmatic access for a specific use case, reach out via{" "}
              <a href="/support" className="underline" style={{ color: ACCENT }}>
                Support
              </a>
              .
            </p>
          </Section>

          <Section id="shortcuts" title="Keyboard Shortcuts">
            <div className="space-y-2">
              {[
                ["Cmd / Ctrl + K", "Open command palette"],
                ["Cmd / Ctrl + /", "Toggle the assistant panel"],
                ["G then S", "Go to Study Hub"],
                ["G then R", "Go to Research Lab"],
                ["G then P", "Go to Placement Engine"],
                ["Esc", "Close any open dialog or panel"],
              ].map(([keys, desc]) => (
                <div key={keys} className="flex items-center justify-between border-b border-white/[0.05] pb-2 text-sm">
                  <span className="text-white/70">{desc}</span>
                  <kbd className="rounded bg-white/[0.06] px-2 py-1 text-xs text-white/60">{keys}</kbd>
                </div>
              ))}
            </div>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <p>
              <strong className="text-white">Upload fails or hangs:</strong> confirm the file is under the size
              limit and is a supported type (PDF, DOCX, PPTX, or common image formats for OCR). Very large scanned
              PDFs can take longer to process — this is expected, not a failure.
            </p>
            <p>
              <strong className="text-white">Generated content looks off-topic:</strong> this usually means the
              source document didn't parse cleanly (common with heavily scanned or image-based PDFs). Try re-uploading
              a text-based version if one is available.
            </p>
            <p>
              <strong className="text-white">Can't sign in:</strong> check that you're using the same sign-in method
              (email or the same OAuth provider) you originally registered with.
            </p>
          </Section>

          <Section id="faq" title="FAQ">
            <p>
              <strong className="text-white">Is my data used to train models?</strong> No — see the AI Usage and
              Data Retention policies for specifics.
            </p>
            <p>
              <strong className="text-white">Can I export my data?</strong> Yes, from Settings inside the app.
            </p>
            <p>
              <strong className="text-white">Is there a mobile app?</strong> Not currently — the web app is fully
              responsive and works on mobile browsers.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
