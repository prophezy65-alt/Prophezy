import type { ReactNode } from "react";
import Link from "next/link";
import Footer from "@/components/marketing/sections/Footer";
import BackButton from "./BackButton";

const ACCENT = "#5ff2ff";

// Shared shell for every non-landing marketing/content page (About, Careers,
// Blog, Docs, Support, Status, Legal). Route-grouped with (site) so none of
// this changes the URL — /about stays /about — and none of it touches the
// landing page itself (app/page.tsx + its own layout are untouched).
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#050505] text-white">
      <header className="border-b border-white/[0.06] px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-5">
            <BackButton />
            <Link href="/" className="flex items-center gap-2 text-sm" style={{ fontFamily: "var(--font-mono)" }}>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
              />
              PROPHEZY
            </Link>
          </div>
          <Link
            href="/signup"
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Boot Prophezy
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}
