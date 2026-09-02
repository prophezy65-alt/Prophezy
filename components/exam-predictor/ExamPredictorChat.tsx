"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2 } from "lucide-react";
import { EXAM_PREDICTOR_COLORS as C } from "./palette";
import type { ExtractedSyllabus, PaperPrediction } from "@/lib/syllabus/models/syllabus.types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type Mode = "explain" | "solve" | "exam-answer" | "simplify" | "example" | "ask";

const QUICK_ACTIONS: { mode: Mode; label: string }[] = [
  { mode: "explain", label: "Explain" },
  { mode: "solve", label: "Solve" },
  { mode: "exam-answer", label: "Exam Answer" },
  { mode: "simplify", label: "Simplify" },
  { mode: "example", label: "Give Example" },
];

export function ExamPredictorChat({
  syllabus,
  prediction,
  externalPrompt,
}: {
  syllabus: ExtractedSyllabus;
  prediction: PaperPrediction;
  /** Set by a parent action (e.g. "Get Answer" on a question card or "Ask AI for a strategy"). */
  externalPrompt?: { text: string; mode?: Mode; nonce: number } | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (externalPrompt) void send(externalPrompt.text, externalPrompt.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt?.nonce]);

  async function send(text: string, mode?: Mode) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    setSending(true);

    try {
      const res = await fetch("/api/exam-predictor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionIdRef.current,
          mode,
          context: {
            syllabus: {
              subjectName: syllabus.subjectName,
              units: syllabus.units,
              marksDistribution: syllabus.marksDistribution,
            },
            prediction: {
              mostImportantTopics: prediction.mostImportantTopics,
              expectedQuestions: prediction.expectedQuestions,
            },
          },
        }),
      });

      if (!res.ok || !res.body) throw new Error(await res.text().catch(() => "Request failed"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accumulated };
          return next;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "_Something went wrong. Please try again._" },
      ]);
    } finally {
      setSending(false);
    }
  }

  const lastAssistantHasContent = messages.length > 0 && messages[messages.length - 1].role === "assistant";

  return (
    <div className="flex w-full max-w-3xl flex-col rounded-2xl p-5" style={{ background: C.canvas, border: `1px solid ${C.wineRed}` }}>
      <h3 className="text-base font-semibold" style={{ color: C.onCanvas }}>
        Ask Prophezy AI
      </h3>

      <div ref={scrollRef} className="mt-3 flex max-h-[420px] flex-col gap-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm" style={{ color: C.onCanvasMuted }}>
            Ask about any predicted question, or anything else from your syllabus — e.g. &ldquo;What are the most
            important topics from Unit 3?&rdquo;
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end" : "self-start"}>
            <div
              className="max-w-[85%] rounded-xl px-3 py-2 text-sm"
              style={
                m.role === "user"
                  ? { background: C.wineRed, color: C.onWineRed }
                  : { background: C.wineRedFaint, color: C.onCanvas }
              }
            >
              {m.content ? (
                <div className="prose prose-sm max-w-none [&_*]:!text-inherit">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <Loader2 size={14} className="animate-spin" />
              )}
            </div>
          </div>
        ))}
      </div>

      {lastAssistantHasContent && !sending && (
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.mode}
              onClick={() => send(messages[messages.length - 1].content, a.mode)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: C.lightSand, color: C.lightSand }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input, "ask");
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a follow-up question..."
          disabled={sending}
          className="h-10 flex-1 rounded-lg border px-3 text-sm outline-none"
          style={{ borderColor: C.wineRed, color: C.onCanvas, background: C.wineRedFaint }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:opacity-40"
          style={{ background: C.lightSand, color: C.onSand }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
