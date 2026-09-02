"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS, MOBILE_PRIMARY_HREFS } from "./nav-items";

const ACCENT = "#5ff2ff";

export default function MobileNavigation() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();

  const primary = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href));
  const rest = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-white/[0.08] bg-[#050505]/95 px-2 py-2 backdrop-blur-xl lg:hidden">
        {primary.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[9px] uppercase tracking-wide"
              style={{ color: active ? ACCENT : "rgba(255,255,255,0.45)" }}
            >
              <Icon size={18} strokeWidth={1.7} />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[9px] uppercase tracking-wide text-white/45"
        >
          <Menu size={18} strokeWidth={1.7} />
          More
        </button>
      </nav>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0a0a0a]/98 p-5 pb-24 backdrop-blur-xl lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.14em] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
                  All modules
                </span>
                <button type="button" onClick={() => setSheetOpen(false)} className="text-white/50">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {rest.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3 text-xs"
                      style={{ color: active ? ACCENT : "rgba(255,255,255,0.75)" }}
                    >
                      <Icon size={15} strokeWidth={1.7} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
