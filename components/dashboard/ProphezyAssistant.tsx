"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, X, Loader2, History, Plus, Trash2, ArrowLeft } from "lucide-react";

const ACCENT = "#5ff2ff";
const SESSION_STORAGE_KEY = "prophezy-assistant-session-id";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatSessionSummary {
  id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
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

function formatSessionDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ProphezyAssistant() {
  const [open, setOpen] = useState(false);
  // "chat" = active conversation, "history" = list of past sessions.
  const [view, setView] = useState<"chat" | "history">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
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

  // Restore the last active conversation on load (e.g. after a page
  // refresh) instead of always starting blank — this is the core of the
  // "history not saving" fix: the session id now survives a reload, and
  // its messages are re-fetched from the DB rather than lost.
  useEffect(() => {
    const savedId = typeof window !== "undefined" ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
    if (savedId) {
      loadSession(savedId, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSessions() {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      // History list failing to load shouldn't block the rest of the widget.
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadSession(sessionId: string, opts?: { silent?: boolean }) {
    if (!opts?.silent) setHistoryLoading(true);
    try {
      const res = await fetch(`/api/chat/${sessionId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const restored: ChatMessage[] = (data.messages ?? []).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));
      sessionIdRef.current = sessionId;
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      setMessages(restored);
      setView("chat");
      setError(null);
    } catch {
      // Saved session id is stale/inaccessible (e.g. deleted) — fall back
      // to a clean slate rather than getting stuck.
      if (opts?.silent) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        sessionIdRef.current = null;
      } else {
        setError("Couldn't load that conversation.");
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  function startNewChat() {
    sessionIdRef.current = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setMessages([]);
    setError(null);
    setView("chat");
  }

  async function deleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (sessionIdRef.current === sessionId) {
      startNewChat();
    }
    try {
      await fetch(`/api/chat/${sessionId}`, { method: "DELETE" });
    } catch {
      // Best-effort — if this fails the session just reappears next time
      // the list is refreshed, which is an acceptable fallback.
    }
  }

  function openHistory() {
    setView("history");
    fetchSessions();
  }

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
            sessionIdRef.current = marker[1] ?? null;
            // Persist as soon as we know it — this is what makes the
            // conversation resumable after a refresh, and what a "new
            // chat" (blank sessionId) turns into its own saved thread.
            if (sessionIdRef.current) {
              localStorage.setItem(SESSION_STORAGE_KEY, sessionIdRef.current);
            }
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
      {/* pointer-events-none on the wrapper + pointer-events-auto on just
          the button/label: without this, the whole fixed rectangle around
          the floating AI button (including the transparent gap between the
          button and its "Ask Prophezy AI" label, and any empty margin
          around them) silently intercepts taps meant for whatever page
          content happens to render underneath it — reported by a customer
          as not being able to tap a list item behind the button. Now only
          the visible button circle and label pill are actually clickable;
          everywhere else in that fixed box passes the tap through to the
          page underneath. */}
      <div className="pointer-events-none fixed bottom-24 right-4 z-50 flex flex-col items-center gap-1.5 sm:bottom-10 sm:right-8">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close Prophezy AI" : "Open Prophezy AI"}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#0a0a0a] shadow-lg transition-transform hover:scale-105"
          style={{ boxShadow: `0 0 24px ${ACCENT}33` }}
        >
          {open ? <X size={20} className="text-white/70" /> : <ProphezyAiIcon size={30} />}
        </button>
        {!open && (
          <span
            className="pointer-events-none whitespace-nowrap rounded-full border border-white/10 bg-[#0a0a0a]/90 px-2.5 py-1 text-[10px] text-white/50"
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
          className="fixed bottom-40 right-4 z-50 flex h-[32rem] max-h-[calc(100vh-13rem)] w-96 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-white/10 bg-[#050505] shadow-2xl sm:bottom-28 sm:right-8 sm:max-h-[32rem] sm:max-w-[calc(100vw-3rem)]"
        >
          <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
            {view === "history" ? (
              <button
                type="button"
                onClick={() => setView("chat")}
                aria-label="Back to chat"
                className="text-white/50 hover:text-white"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <ProphezyAiIcon size={20} />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
                {view === "history" ? "Chat history" : "Prophezy AI"}
              </div>
              {view === "chat" && (
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
                  Knows your dashboard
                </div>
              )}
            </div>
            {view === "chat" ? (
              <>
                <button
                  type="button"
                  onClick={startNewChat}
                  aria-label="Start new chat"
                  title="New chat"
                  className="text-white/50 hover:text-white"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={openHistory}
                  aria-label="View chat history"
                  title="History"
                  className="text-white/50 hover:text-white"
                >
                  <History size={16} />
                </button>
              </>
            ) : null}
          </div>

          {view === "history" ? (
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {sessionsLoading && (
                <div className="flex items-center justify-center py-8 text-white/40">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              )}
              {!sessionsLoading && sessions.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-white/40">No past conversations yet.</p>
              )}
              {!sessionsLoading &&
                sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => loadSession(s.id)}
                    className={`group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] ${
                      sessionIdRef.current === s.id ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/85">{s.title || "New conversation"}</p>
                      <p className="text-[10px] text-white/35">{formatSessionDate(s.last_message_at ?? s.created_at)}</p>
                    </div>
                    <span
                      onClick={(e) => deleteSession(s.id, e)}
                      role="button"
                      aria-label="Delete conversation"
                      className="shrink-0 rounded p-1 text-white/25 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </span>
                  </button>
                ))}
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {historyLoading && (
                  <div className="flex items-center justify-center py-8 text-white/40">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                )}
                {!historyLoading && messages.length === 0 && (
                  <p className="text-xs leading-relaxed text-white/40">
                    Ask about your resume, interview prep, flashcards, research, projects, or what to do next —
                    I can see your real progress across Prophezy.
                  </p>
                )}
                {!historyLoading &&
                  messages.map((m, i) => (
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
            </>
          )}
        </div>
      )}
    </>
  );
}
