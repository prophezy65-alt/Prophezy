import Link from "next/link";

const ACCENT = "#5ff2ff";

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/cookies", label: "Cookie Policy" },
  { href: "/legal/ai-usage", label: "AI Usage Policy" },
  { href: "/legal/data-retention", label: "Data Retention Policy" },
  { href: "/legal/acceptable-use", label: "Acceptable Use Policy" },
];

export default function LegalPageShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <div className="mb-3 text-xs uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
              Legal
            </div>
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block rounded-lg px-3 py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="max-w-2xl">
          <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            Legal
          </div>
          <h1
            className="text-[clamp(28px,4vw,42px)] font-medium leading-[1.15] tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          <p className="mt-3 text-xs text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            Last updated {updated}
          </p>

          <div className="prose prose-invert prose-headings:font-medium mt-10 max-w-none prose-headings:tracking-tight prose-h2:mt-10 prose-h2:text-lg prose-p:leading-relaxed prose-p:text-white/65 prose-li:text-white/65 prose-strong:text-white prose-a:text-[#5ff2ff]">
            {children}
          </div>

          <div className="mt-16 border-t border-white/[0.06] pt-6">
            <p className="text-xs text-white/40">
              Questions about any of these policies? Reach us at{" "}
              <a href="mailto:prophezy65@gmail.com" style={{ color: ACCENT }}>
                prophezy65@gmail.com
              </a>{" "}
              /{" "}
              <a href="tel:+919258903072" style={{ color: ACCENT }}>
                +91 92589 03072
              </a>{" "}
              or through{" "}
              <Link href="/support" style={{ color: ACCENT }}>
                Support
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
