"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Linkedin, Instagram } from "lucide-react";
import { useContactModal } from "@/components/providers/contact-modal-provider";

const ACCENT = "#5ff2ff";

interface FooterLink {
  label: string;
  href: string;
}

// Every column link now maps to a real route. Visual structure, copy, and
// styling are unchanged from the original — only the href on each link (and
// the Link/span branch below) changed, so every item is clickable.
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "System",
    links: [
      { label: "Study Hub", href: "/app/study-hub" },
      { label: "Research Lab", href: "/app/research-papers" },
      { label: "Resume Studio", href: "/app/resume-studio" },
      { label: "Placement Engine", href: "/app/opportunities" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Status", href: "/status" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
      // "Contact" opens the Contact modal rather than navigating — handled
      // as a special case in the render below — but sits in the list here
      // so it lines up beside Privacy/Terms with identical spacing.
      { label: "Contact", href: "#contact" },
    ],
  },
];

export default function Footer() {
  const { openContact } = useContactModal();

  return (
    <footer className="relative border-t border-white/[0.06] px-6 pb-10 pt-24">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2"
        style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}55, transparent)` }}
      />

      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <h2
            className="text-[clamp(28px,4.5vw,52px)] font-medium leading-[1.1] tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Stop switching.
            <br />
            Start booting.
          </h2>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-medium text-[#050505]"
            style={{ backgroundColor: ACCENT, boxShadow: `0 0 30px ${ACCENT}44` }}
          >
            Boot Prophezy
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 gap-10 border-t border-white/[0.06] pt-14 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div
                className="mb-4 text-[11px] uppercase tracking-[0.12em] text-[var(--dim)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {col.title}
              </div>
              <ul className="space-y-2.5">
                {col.links.map((link) =>
                  link.label === "Contact" ? (
                    <li key={link.label}>
                      <button
                        type="button"
                        onClick={openContact}
                        className="cursor-pointer text-sm text-white/70 transition-colors hover:text-white"
                      >
                        {link.label}
                      </button>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="cursor-pointer text-sm text-white/70 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 text-xs text-[var(--dim)] sm:flex-row">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
            />
            PROPHEZY
          </div>
          <span>© {new Date().getFullYear()} Prophezy. All systems operational.</span>
          <div className="flex items-center gap-3">
            <span
              className="text-[11px] uppercase tracking-[0.14em] text-white/50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Follow us
            </span>
            <a
              href="https://www.linkedin.com/company/prophezy/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Prophezy on LinkedIn"
              className="group flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5ff2ff]/40 hover:text-[#5ff2ff]"
              style={{ boxShadow: "0 0 0 rgba(95,242,255,0)" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 18px rgba(95,242,255,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 0 rgba(95,242,255,0)")}
            >
              <Linkedin size={20} />
            </a>
            <a
              href="https://www.instagram.com/proph_ezy?igsi=MmJ3ODlwd3FrZXVs"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Prophezy on Instagram"
              className="group flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5ff2ff]/40 hover:text-[#5ff2ff]"
              style={{ boxShadow: "0 0 0 rgba(95,242,255,0)" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 18px rgba(95,242,255,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 0 rgba(95,242,255,0)")}
            >
              <Instagram size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
