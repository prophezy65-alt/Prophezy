"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useContactModal } from "@/components/providers/contact-modal-provider";

interface NavbarProps {
  booted: boolean;
}

// Landing-page anchors each nav item jumps to (single-page marketing site).
const LINKS: { label: string; href: string }[] = [
  { label: "System", href: "#top" },
  { label: "Modules", href: "#modules" },
  { label: "Intelligence", href: "#intelligence" },
  { label: "Access", href: "#pricing" },
  { label: "Pricing", href: "#pricing" },
];

export default function Navbar({ booted }: NavbarProps) {
  const { openContact } = useContactModal();

  return (
    <motion.div
      initial={{ opacity: 0, y: -14 }}
      animate={booted ? { opacity: 1, y: 0 } : { opacity: 0, y: -14 }}
      transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ pointerEvents: booted ? "auto" : "none" }}
      className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-11 py-7"
    >
      <a
        href="#top"
        className="flex items-center gap-2.5 text-sm font-medium tracking-wide"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--wc, #5ff2ff)", boxShadow: "0 0 10px var(--wc, #5ff2ff)" }}
        />
        PROPHEZY
      </a>

      <div className="hidden gap-9 text-xs tracking-wide text-[var(--dim)] md:flex">
        {LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="cursor-pointer transition-colors hover:text-white focus:text-white focus:outline-none"
          >
            {link.label}
          </a>
        ))}
        <button
          type="button"
          onClick={openContact}
          className="cursor-pointer transition-colors hover:text-white focus:text-white focus:outline-none"
        >
          Contact
        </button>
      </div>

      <Link
        href="/signup"
        className="rounded-full border border-white/10 bg-white/[0.04] px-4.5 py-2 text-xs backdrop-blur-md transition-colors hover:border-white/25"
      >
        Enter the OS
      </Link>
    </motion.div>
  );
}
