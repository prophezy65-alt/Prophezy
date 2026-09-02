"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Send, Sparkles, X } from "lucide-react";

const ACCENT = "#5ff2ff";

type Reason = "general" | "support" | "partnership" | "feedback" | "bug" | "business";

const REASONS: { value: Reason; label: string }[] = [
  { value: "general", label: "General" },
  { value: "support", label: "Support" },
  { value: "partnership", label: "Partnership" },
  { value: "feedback", label: "Feedback" },
  { value: "bug", label: "Bug report" },
  { value: "business", label: "Business" },
];

type Status = "idle" | "submitting" | "success" | "error";

interface FieldErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MAX = 3000;

const EMPTY_FORM = { name: "", email: "", subject: "", message: "", reason: "general" as Reason };

export default function ContactModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const triggerElRef = useRef<Element | null>(null);

  // Lock page scroll, remember the element that opened the modal (so focus
  // can return to it on close), and focus the first field.
  useEffect(() => {
    if (!isOpen) return;

    triggerElRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 50);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      if (triggerElRef.current instanceof HTMLElement) {
        triggerElRef.current.focus();
      }
    };
  }, [isOpen]);

  // Escape to close + a minimal focus trap so Tab never escapes the dialog.
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset transient state a beat after the close animation finishes, but
  // only once idle/success — never wipe an in-progress or errored form.
  useEffect(() => {
    if (isOpen || status === "error") return;
    const timer = window.setTimeout(() => {
      setStatus("idle");
      setFieldErrors({});
      setErrorMessage("");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isOpen, status]);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in fieldErrors) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = "Tell us who you are.";
    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) errors.email = "Enter a valid email.";
    if (!form.subject.trim()) errors.subject = "Add a subject.";
    else if (form.subject.trim().length > 150) errors.subject = "Keep it under 150 characters.";
    if (!form.message.trim()) errors.message = "Write your message.";
    else if (form.message.trim().length < 10) errors.message = "A few more words would help.";
    else if (form.message.trim().length > MESSAGE_MAX) errors.message = `Keep it under ${MESSAGE_MAX} characters.`;
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
          reason: form.reason,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Couldn't send your message.");
      }

      setStatus("success");
      setForm(EMPTY_FORM);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Couldn't send your message.");
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const inputClass =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[var(--wc,#5ff2ff)]/50 focus:ring-2 focus:ring-[var(--wc,#5ff2ff)]/15";
  const labelClass = "mb-1.5 block text-xs text-white/50";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
            aria-describedby="contact-modal-desc"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0a0a0c]/90 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_0_60px_rgba(95,242,255,0.08)] backdrop-blur-2xl sm:max-w-md sm:rounded-3xl sm:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close contact form"
              className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/50 transition-colors hover:border-white/25 hover:text-white"
            >
              <X size={15} />
            </button>

            {status === "success" ? (
              <div className="flex flex-col items-center py-6 text-center">
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${ACCENT}1a`, boxShadow: `0 0 30px ${ACCENT}33` }}
                >
                  <CheckCircle2 size={28} style={{ color: ACCENT }} />
                </motion.span>
                <h2
                  id="contact-modal-title"
                  className="mt-5 text-xl font-medium text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Message sent.
                </h2>
                <p className="mt-2 text-sm text-white/60">Thanks — we&apos;ll get back to you soon.</p>
                <div className="mt-7 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="rounded-full border border-white/10 px-5 py-2.5 text-xs text-white/70 transition-colors hover:border-white/25 hover:text-white"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Send another
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full px-5 py-2.5 text-xs font-medium text-[#050505]"
                    style={{ backgroundColor: ACCENT }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-start gap-3.5">
                  <span
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${ACCENT}1a`, boxShadow: `0 0 18px ${ACCENT}26` }}
                  >
                    <Sparkles size={17} style={{ color: ACCENT }} />
                  </span>
                  <div>
                    <h2
                      id="contact-modal-title"
                      className="text-xl font-medium leading-tight text-white sm:text-2xl"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Let&apos;s talk.
                    </h2>
                    <p id="contact-modal-desc" className="mt-1.5 text-sm leading-relaxed text-white/55">
                      Have a question, idea, partnership request, or something we should know? Drop us a message.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-name" className={labelClass}>
                        Name
                      </label>
                      <input
                        id="contact-name"
                        ref={nameInputRef}
                        type="text"
                        value={form.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="Your name"
                        maxLength={120}
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
                        className={inputClass}
                      />
                      {fieldErrors.name && (
                        <p id="contact-name-error" className="mt-1.5 text-xs text-red-400">
                          {fieldErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="contact-email" className={labelClass}>
                        Email
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder="you@example.com"
                        maxLength={200}
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
                        className={inputClass}
                      />
                      {fieldErrors.email && (
                        <p id="contact-email-error" className="mt-1.5 text-xs text-red-400">
                          {fieldErrors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-reason" className={labelClass}>
                      Reason
                    </label>
                    <div className="relative">
                      <select
                        id="contact-reason"
                        value={form.reason}
                        onChange={(e) => updateField("reason", e.target.value as Reason)}
                        className={`${inputClass} appearance-none pr-10`}
                      >
                        {REASONS.map((r) => (
                          <option key={r.value} value={r.value} className="bg-[#0a0a0c] text-white">
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={15}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className={labelClass}>
                      Subject
                    </label>
                    <input
                      id="contact-subject"
                      type="text"
                      value={form.subject}
                      onChange={(e) => updateField("subject", e.target.value)}
                      placeholder="What's this about?"
                      maxLength={150}
                      aria-invalid={!!fieldErrors.subject}
                      aria-describedby={fieldErrors.subject ? "contact-subject-error" : undefined}
                      className={inputClass}
                    />
                    {fieldErrors.subject && (
                      <p id="contact-subject-error" className="mt-1.5 text-xs text-red-400">
                        {fieldErrors.subject}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contact-message" className={labelClass}>
                      Message
                    </label>
                    <textarea
                      id="contact-message"
                      value={form.message}
                      onChange={(e) => updateField("message", e.target.value)}
                      placeholder="Tell us what's on your mind…"
                      rows={4}
                      maxLength={MESSAGE_MAX}
                      aria-invalid={!!fieldErrors.message}
                      aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
                      className={`${inputClass} resize-none`}
                    />
                    {fieldErrors.message && (
                      <p id="contact-message-error" className="mt-1.5 text-xs text-red-400">
                        {fieldErrors.message}
                      </p>
                    )}
                  </div>

                  {status === "error" && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3"
                    >
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-red-400" />
                      <div>
                        <p className="text-sm text-white/85">Couldn&apos;t send your message.</p>
                        <p className="mt-0.5 text-xs text-white/50">
                          {errorMessage || "Please try again in a moment."}
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium text-[#050505] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: ACCENT, boxShadow: `0 0 24px ${ACCENT}33` }}
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        Send message
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
