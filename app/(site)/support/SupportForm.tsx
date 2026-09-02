"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

const ACCENT = "#5ff2ff";

type Kind = "bug" | "feature" | "general";

const KIND_LABEL: Record<Kind, string> = {
  bug: "Report a bug",
  feature: "Request a feature",
  general: "General question",
};

export default function SupportForm() {
  const [kind, setKind] = useState<Kind>("bug");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          email,
          subject,
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Something went wrong. Please try again.");
      }

      setStatus("sent");
      setSubject("");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-white/[0.08] p-8 text-center">
        <h3 className="text-lg font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
          Got it — thanks.
        </h3>
        <p className="mt-2 text-sm text-white/60">
          We read every submission and typically respond within 1–2 business days at the email you provided.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-5 text-xs underline"
          style={{ color: ACCENT, fontFamily: "var(--font-mono)" }}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-white/[0.08] p-6">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
              kind === k ? "border-white/30 text-white" : "border-white/[0.08] text-white/50 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-xs text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
          Your email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
          Subject
        </label>
        <input
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Short summary"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
          {kind === "bug" ? "What happened, and what did you expect instead?" : "Details"}
        </label>
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            kind === "bug"
              ? "Steps to reproduce, what you saw, what you expected…"
              : "Tell us what you need…"
          }
          className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
        />
      </div>

      {status === "error" && <p className="text-xs text-red-400">{errorMsg}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-[#050505] disabled:opacity-60"
          style={{ backgroundColor: ACCENT }}
        >
          {status === "submitting" && <Loader2 size={14} className="animate-spin" />}
          Send
        </button>
        <a href="mailto:prophezy65@gmail.com" className="text-xs text-white/40 hover:text-white">
          or email prophezy65@gmail.com directly →
        </a>
      </div>
    </form>
  );
}
