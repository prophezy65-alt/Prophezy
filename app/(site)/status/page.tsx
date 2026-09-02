import type { Metadata } from "next";
import StatusPanel from "./StatusPanel";

export const metadata: Metadata = {
  title: "Status — Prophezy",
  description: "Live status of Prophezy's frontend, API, database, storage, and AI services.",
};

export default function StatusPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="mb-10">
        <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Status
        </div>
        <h1
          className="max-w-xl text-[clamp(30px,4.5vw,48px)] font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          System status
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
          Live checks against the actual services Prophezy depends on — not a static page. Each row reflects a real
          request made when this page loaded.
        </p>
      </div>

      <StatusPanel />
    </div>
  );
}
