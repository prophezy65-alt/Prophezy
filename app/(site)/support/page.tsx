import type { Metadata } from "next";
import SupportForm from "./SupportForm";

const ACCENT = "#5ff2ff";

export const metadata: Metadata = {
  title: "Support — Prophezy",
  description: "Get help with Prophezy — help center, bug reports, feature requests, and direct support.",
};

const FAQ = [
  { q: "How fast do you respond?", a: "We aim to respond within 1–2 business days. Bug reports affecting core functionality are prioritized." },
  { q: "Where do I report a security issue?", a: "Email prophezy65@gmail.com directly rather than using the general form — we treat these separately and with priority." },
  { q: "Can I request a feature?", a: "Yes — use the \"Request a feature\" option below. We read every submission, even if we can't reply to each individually." },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-14">
        <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Support
        </div>
        <h1
          className="max-w-2xl text-[clamp(30px,4.5vw,48px)] font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Help Center
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
          Check the FAQ below, or send us a message directly — bug reports and feature requests both go to the same
          team.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="mb-6 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            Contact
          </h2>
          <SupportForm />
        </div>

        <div>
          <h2 className="mb-6 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            Other ways to reach us
          </h2>
          <div className="mb-10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-sm">
              <span className="text-white/60">Email support</span>
              <a href="mailto:prophezy65@gmail.com" style={{ color: ACCENT }}>
                prophezy65@gmail.com
              </a>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-sm">
              <span className="text-white/60">Phone</span>
              <a href="tel:+919258903072" style={{ color: ACCENT }}>
                +91 92589 03072
              </a>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-sm">
              <span className="text-white/60">Community (Discord)</span>
              <span className="text-white/40">Coming soon</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-sm">
              <span className="text-white/60">Typical response time</span>
              <span className="text-white/80">1–2 business days</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-sm">
              <span className="text-white/60">System status</span>
              <a href="/status" style={{ color: ACCENT }}>
                status.prophezy.app
              </a>
            </div>
          </div>

          <h2 className="mb-6 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            FAQ
          </h2>
          <div className="space-y-6">
            {FAQ.map((f) => (
              <div key={f.q} className="border-b border-white/[0.06] pb-6">
                <h3 className="mb-2 text-sm font-medium text-white">{f.q}</h3>
                <p className="text-sm leading-relaxed text-white/60">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
