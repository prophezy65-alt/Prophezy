"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, X, Loader2 } from "lucide-react";

const ACCENT = "#5ff2ff";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Inline recreation of the supplied Prophezy AI mark — no external asset file required. */
function ProphezyAiIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const x1 = 32 + Math.cos(angle) * 15;
        const y1 = 32 + Math.sin(angle) * 15;
        const x2 = 32 + Math.cos(angle) * 29;
        const y2 = 32 + Math.sin(angle) * 29;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeWidth="1.4" opacity={0.7} />
            <circle cx={x2} cy={y2} r="1.6" fill={ACCENT} opacity={0.9} />
          </g>
        );
      })}
      <circle cx="32" cy="32" r="16" fill="#050505" stroke={ACCENT} strokeWidth="1.4" />
      <text x="32" y="37" textAnchor="middle" fontSize="12" fontWeight="700" fill={ACCENT} fontFamily="var(--font-mono), monospace">
        AI
      </text>
    </svg>
  );
}

export default function ProphezyAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("prophezy-assistant:open", openHandler);
    return () => window.removeEventListener("prophezy-assistant:open", openHandler);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";
      let sessionMarkerConsumed = false;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!sessionMarkerConsumed) {
          const marker = buffer.match(/^__SESSION__:([^\n]+)\n/);
          if (marker) {
            sessionIdRef.current = marker[1];
            buffer = buffer.slice(marker[0].length);
            sessionMarkerConsumed = true;
          } else {
            // Marker line hasn't fully arrived yet — wait for more data
            // before appending anything to the visible transcript.
            continue;
          }
        }

        accumulated += buffer;
        buffer = "";
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accumulated };
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-10 right-8 z-50 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close Prophezy AI" : "Open Prophezy AI"}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#0a0a0a] shadow-lg transition-transform hover:scale-105"
          style={{ boxShadow: `0 0 24px ${ACCENT}33` }}
        >
          {open ? <X size={20} className="text-white/70" /> : <ProphezyAiIcon size={30} />}
        </button>
        {!open && (
          <span
            className="whitespace-nowrap rounded-full border border-white/10 bg-[#0a0a0a]/90 px-2.5 py-1 text-[10px] text-white/50"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Ask Prophezy AI
          </span>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Prophezy AI assistant"
          className="fixed bottom-28 right-8 z-50 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col rounded-xl border border-white/10 bg-[#050505] shadow-2xl"
        >
          <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
            <ProphezyAiIcon size={20} />
            <div>
              <div className="text-sm font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
                Prophezy AI
              </div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
                Knows your dashboard
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-xs leading-relaxed text-white/40">
                Ask about your resume, interview prep, flashcards, research, projects, or what to do next —
                I can see your real progress across Prophezy.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-left text-sm ${
                    m.role === "user" ? "bg-white/[0.06] text-white" : "bg-white/[0.02] text-white/80"
                  }`}
                >
                  {m.content ? (
                    <div className="prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <Loader2 size={14} className="animate-spin text-white/40" />
                  )}
                </div>
              </div>
            ))}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-end gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Prophezy AI…"
                rows={1}
                className="max-h-24 flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                aria-label="Send message"
                className="shrink-0 disabled:opacity-30"
              >
                <Send size={16} style={{ color: ACCENT }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
