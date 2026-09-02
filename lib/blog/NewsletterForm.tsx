"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

const ACCENT = "#5ff2ff";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-white/70">
        <Check size={15} style={{ color: ACCENT }} />
        Subscribed — welcome aboard.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20 sm:w-64"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-[#050505] disabled:opacity-60"
        style={{ backgroundColor: ACCENT }}
      >
        {status === "submitting" && <Loader2 size={14} className="animate-spin" />}
        Subscribe
      </button>
      {status === "error" && <p className="text-xs text-red-400 sm:ml-2 sm:self-center">Something went wrong — try again.</p>}
    </form>
  );
}
