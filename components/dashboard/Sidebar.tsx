"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

const ACCENT = "#5ff2ff";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.07] bg-[#050505]/95 backdrop-blur-xl lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/[0.07] px-6">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
        <span className="text-sm font-semibold uppercase tracking-[0.14em] text-white">Prophezy</span>
        <span className="ml-auto rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-white/40">
          OS
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors"
                  style={{
                    color: active ? "#fff" : "rgba(255,255,255,0.55)",
                    backgroundColor: active ? `${ACCENT}12` : "transparent",
                  }}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full"
                      style={{ backgroundColor: ACCENT }}
                    />
                  )}
                  <Icon size={16} strokeWidth={1.7} style={{ color: active ? ACCENT : undefined }} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/[0.07] p-4">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
            AI Active
          </span>
        </div>
      </div>
    </aside>
  );
}
